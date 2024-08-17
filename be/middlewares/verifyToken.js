import jwt from 'jsonwebtoken';

export default function verifyToken(req, res, next) {
    const token = req.cookie.token

    if (!token) {
        return res.status(401).json({success: false, message: "Access denied. No token provided"});
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if(!decoded) {
            return res.status(401).json({success: false, message: "Invalid token"});
        }
        req.userId = decoded.userId;
        next();
    } catch (error) {
        console.log("Error verifying token: ", error.message);
        res.status(400).json({success: false, message: "Invalid token"});
    }
}