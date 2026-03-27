import { Response, NextFunction } from 'express';
import bcrypt                       from 'bcryptjs';
import { AuthRequest }              from '../types';
import { AppError }                 from '../utils/AppError';
import { EmployeeModel }            from '../models/Employee.model';
import { UserModel }                from '../models/User.model';

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

    const employee = await EmployeeModel.findById(id);
    const { password: _pw, ...safe } = employee!;
    res.status(201).json({ success: true, data: safe });
  } catch (err) {
    next(err);
  }
}

export async function updateEmployeePermissions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { permissions } = req.body;

    const employee = await EmployeeModel.findById(id);
    if (!employee) throw new AppError('Employé introuvable', 404);

    await EmployeeModel.setPermissions(id, permissions ?? []);

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

    await EmployeeModel.delete(id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}