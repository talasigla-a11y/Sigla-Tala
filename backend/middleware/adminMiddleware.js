const verifyAdmin = (req, res, next) => {
    if (!req.user || !req.user.role) {
        return res.status(401).json({
            success: false,
            message: "Access denied. Authentication required."
        });
    }

    if (String(req.user.role).toLowerCase() !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Admin privileges required."
        });
    }

    next();
};

module.exports = verifyAdmin;
