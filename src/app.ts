import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { globalErrorHandler } from './middlewares/errorHandler';
import { globalRateLimiter } from './middlewares/rateLimiter';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import wishlistRoutes from './routes/wishlist.routes';
import devisRoutes from './routes/devis.routes';
import uploadRoutes from './routes/upload.routes';
import inspirationRoutes from './routes/inspiration.routes';
import contactRoutes from './routes/contact.routes';
import passwordResetRoutes from './routes/passwordReset.routes';
import blogRoutes from './routes/blog.routes';
import codePromoRoutes from './routes/codePromo.routes';


const app = express();

app.use(helmet());
app.use(
  cors({
    origin: [
      'localhost:5173',
      'http://localhost:5173',
      'ucpe.vercel.app',
      'ucpe.vercel.app/',
      'https://ucpe.vercel.app',
      'https://ucpe.vercel.app/',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(process.cwd(), 'uploads')));

app.use('/api', globalRateLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/wishlists', wishlistRoutes);
app.use('/api/devis', devisRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/inspiration', inspirationRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/codepromo', codePromoRoutes);


app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));

app.use(globalErrorHandler);

export default app;