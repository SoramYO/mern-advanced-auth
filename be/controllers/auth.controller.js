import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { sendResetPasswordEmail, sendResetPasswordEmailSuccess, sendVerificationEmail, sendWelcomeEmail } from '../mails/emails.js';
import { User } from "../models/user.model.js";
import { generateTokenAndSetCookie } from '../utils/generateTokenAndSetCookie.js';
dotenv.config();

export const checkAuth = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password");
        if (!user) {
            return res.status(400).json({success: false, message: "User not found"});
        }
        res.status(200).json({success: true, user});

    } catch (error) {
        console.log("Error in checkAuth route: ", error.message);
        res.status(400).json({success: false, message: error.message});
    }
}

export const signup = async (req, res) => {
    const { email, password, name } = req.body;

    try {
        if (!email || !password || !name) {
            throw new Error("Please fill in all fields");
        }

        const userExists = await User.findOne({email});

        if (userExists) {
            return res.status(400).json({success: false, message: "User already exists"});
        }

        const hashedPassword = await bcryptjs.hash(password, 10);
        const verificationToken =  Math.floor(100000 + Math.random() * 900000).toString();
        const user = await User.create({
            email,
            password: hashedPassword,
            name,
            verificationToken: verificationToken,
            verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours

        });

        await user.save();

        generateTokenAndSetCookie(res, user._id);

        sendVerificationEmail(email, verificationToken);

        res.status(201).send({
            success: true,
            message: "User created successfully",
            user: {
                ...user._doc,
                password: undefined
            }
        });
        
    }catch (error) {
        console.log("Error in signup route: ", error.message);
        res.status(400).json({success: false, message: error.message});
    }
}

export const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            throw new Error("Please fill in all fields");
        }

        const user = await User.findOne({email});

        if (!user) {
            return res.status(400).json({success: false, message: "Account not found"});
        }

        const isMatch = await bcryptjs.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({success: false, message: "Wrong password"});
        }

        user.lastLogin = Date.now();
        await user.save();

        generateTokenAndSetCookie(res, user._id);

        res.status(200).send({
            success: true,
            message: "Logged in successfully",
            user: {
                ...user._doc,
                password: undefined
            }
        });
        
    } catch (error) {
        console.log("Error in login route: ", error.message);
        res.status(400).json({success: false, message: error.message});
        
    }
}

export const logout = async (req, res) => {
    res.clearCookie("token")
    res.status(200).json({success: true, message: "Logged out successfully"});
}

export const verifyEmail = async (req, res) => {
    const { code } = req.body;

    try {
        if (!code) {
            throw new Error("Please provide verification token");
        }

        const user = await User.findOne({
            verificationToken : code,
            verificationTokenExpires: {$gt: Date.now()}
        });
        if(!user) {
            return res.status(400).json({success: false, message: "Invalid or expired verification token"});
        }
        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        await user.save();

        await sendWelcomeEmail(user.email, user.name);

        res.status(200).json({
            success: true, 
            message: "Verified successfully",
            user: {
                ...user._doc,
                password: undefined
            }
        });
    }catch (error) {
        console.log("Error in verifyEmail route: ", error.message);
        res.status(400).json({success: false, message: error.message});
    }
}

export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        if (!email) {
            throw new Error("Please provide email");
        }

        const user = await User.findOne({email});
        if (!user) {
            return res.status(400).json({success: false, message: "Account not found"});
        }

        const resetPasswordToken = crypto.randomBytes(20).toString('hex');
        const resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

        user.resetPasswordToken = resetPasswordToken;
        user.resetPasswordExpires = resetPasswordExpires;
        await user.save();

        const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetPasswordToken}`;
        // Send email with reset link
        await sendResetPasswordEmail(email, resetURL);

        res.status(200).json({success: true, message: "Password reset link sent to your email"});


    }catch (error) {
        console.log("Error in forgotPassword route: ", error.message);
        res.status(400).json({success: false, message: error.message});
    }
}

export const resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.status(400).json({success: false, message: "Passwords do not match"});
    }

    try {
        if (!token || !password) {
            throw new Error("Please provide reset token and new password");
        }

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: {$gt: Date.now()}
        });

        if (!user) {
            return res.status(400).json({success: false, message: "Invalid or expired reset token"});
        }

        const hashedPassword = await bcryptjs.hash(password, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        sendResetPasswordEmailSuccess(user.email);

        res.status(200).json({success: true, message: "Password reset successful"});

    }catch (error) {
        console.log("Error in resetPassword route: ", error.message);
        res.status(400).json({success: false, message: error.message});
    }
}

