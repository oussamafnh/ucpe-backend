import { Response, NextFunction } from 'express';
import bcrypt                       from 'bcryptjs';
import { AuthRequest }              from '../types';
import { AppError }                 from '../utils/AppError';
import { EmployeeModel }            from '../models/Employee.model';
import { UserModel }                from '../models/User.model';
import { DevisNotificationEmailModel } from '../models/DevisNotificationEmail.model';

export async function listEmployees(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const employees = await EmployeeModel.findAll();
    const safe = employees.map(({ password, ...rest }) => rest);
    res.json({ success: true, data: safe });
  } catch (err) {
    next(err);
  }
}

export async function createEmployee(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { firstName, lastName, email, password, permissions = [] } = req.body;

    const existing = await UserModel.findByEmail(email);
    if (existing) throw new AppError('Cet email est déjà utilisé', 409);

    const hashed = await bcrypt.hash(password, 12);
    const id = await EmployeeModel.create({ firstName, lastName, email, password: hashed });

    if (permissions.length) {
      await EmployeeModel.setPermissions(id, permissions);
    }

    if (permissions.includes('devis')) {
      await DevisNotificationEmailModel.create(email, `${firstName} ${lastName}`.trim());
    }

    const employee = await EmployeeModel.findById(id);
    const { password: _pw, ...safe } = employee!;
    res.status(201).json({ success: true, data: safe });
  } catch (err) {
    next(err);
  }
}

async function syncDevisNotification(
  targetEmail: string,
  label: string,
  hadDevis: boolean,
  hasDevis: boolean,
) {
  const normalizedEmail = targetEmail.trim().toLowerCase();

  if (!hadDevis && hasDevis) {
    const all   = await DevisNotificationEmailModel.findAll();
    const entry = all.find(e => e.email === normalizedEmail);
    if (!entry) {
      await DevisNotificationEmailModel.create(normalizedEmail, label);
    } else if (!entry.active) {
      await DevisNotificationEmailModel.update(entry.id, { active: true });
    }
  }

  if (hadDevis && !hasDevis) {
    const all   = await DevisNotificationEmailModel.findAll();
    const entry = all.find(e => e.email === normalizedEmail);
    if (entry) {
      await DevisNotificationEmailModel.update(entry.id, { active: false });
    }
  }
}

export async function updateEmployeePermissions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id          = parseInt(req.params.id as string, 10);
    const { permissions } = req.body;

    const employee = await EmployeeModel.findById(id);
    if (!employee) throw new AppError('Employé introuvable', 404);

    await EmployeeModel.setPermissions(id, permissions ?? []);

    await syncDevisNotification(
      employee.email,
      `${employee.firstName} ${employee.lastName}`.trim(),
      employee.permissions.includes('devis'),
      Array.isArray(permissions) && permissions.includes('devis'),
    );

    const updated = await EmployeeModel.findById(id);
    const { password: _pw, ...safe } = updated!;
    res.json({ success: true, data: safe });
  } catch (err) {
    next(err);
  }
}

export async function updateEmployee(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { firstName, lastName, email, password, permissions } = req.body;

    const employee = await EmployeeModel.findById(id);
    if (!employee) throw new AppError('Employé introuvable', 404);

    const updateData: Record<string, unknown> = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName)  updateData.lastName  = lastName;
    if (email)     updateData.email     = email;
    if (password)  updateData.password  = await bcrypt.hash(password, 12);

    if (Object.keys(updateData).length) {
      await UserModel.update(id, updateData as any);
    }

    if (Array.isArray(permissions)) {
      await EmployeeModel.setPermissions(id, permissions);

      const hadDevis    = employee.permissions.includes('devis');
      const hasDevis    = permissions.includes('devis');
      const targetEmail = (email ?? employee.email).trim().toLowerCase();
      const label       = `${firstName ?? employee.firstName} ${lastName ?? employee.lastName}`.trim();

      await syncDevisNotification(targetEmail, label, hadDevis, hasDevis);

      if (email && hasDevis) {
        const oldEmail = employee.email.trim().toLowerCase();
        const newEmail = email.trim().toLowerCase();
        if (oldEmail !== newEmail) {
          const all   = await DevisNotificationEmailModel.findAll();
          const entry = all.find(e => e.email === oldEmail);
          if (entry) await DevisNotificationEmailModel.update(entry.id, { email: newEmail });
        }
      }
    }

    const updated = await EmployeeModel.findById(id);
    const { password: _pw, ...safe } = updated!;
    res.json({ success: true, data: safe });
  } catch (err) {
    next(err);
  }
}

export async function deleteEmployee(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id as string, 10);

    const employee = await EmployeeModel.findById(id);
    if (!employee) throw new AppError('Employé introuvable', 404);

    if (employee.permissions.includes('devis')) {
      const all   = await DevisNotificationEmailModel.findAll();
      const entry = all.find(e => e.email === employee.email.trim().toLowerCase());
      if (entry)  await DevisNotificationEmailModel.update(entry.id, { active: false });
    }

    await EmployeeModel.delete(id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}