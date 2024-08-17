import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { connectDB } from './db/connectDB.js';
import authRoutes from './routes/auth.routes.js';
const app = express();
const PORT = process.env.PORT || 5000;
dotenv.config();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
        origin: process.env.CLIENT_URL,
        credentials: true,
}));

app.use("/api/v1/", authRoutes);

app.listen(PORT, () => {
        connectDB();
        console.log('Server is running on port', PORT);
});