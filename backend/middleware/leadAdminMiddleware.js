const verifyLeadAdmin = (req, res, next) => {
    if (!req.user || !req.user.role) {
        return res.status(401).json({
            success: false,
            message: "Access denied. Authentication required."
        });
    }

    if (String(req.user.role).toLowerCase() !== "lead-admin") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Lead-admin privileges required."
        });
    }

    next();
};

module.exports = verifyLeadAdmin;
