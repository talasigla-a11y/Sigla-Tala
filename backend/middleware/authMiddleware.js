// JWT is used to prove that a request belongs to a signed-in user.
const jwt = require("jsonwebtoken");

// Reads the Bearer token, verifies its signature, and attaches the user to the request.
const verifyToken = (req, res, next) => {

    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: "Access denied. No token provided."
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Invalid token format."
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {

        if (err) {
            return res.status(403).json({
                success: false,
                message: "Invalid or expired token."
            });
        }

        req.user = decoded;

        next();
    });

};

module.exports = verifyToken;