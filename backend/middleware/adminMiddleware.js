// Allows a request to continue only when authentication middleware identified a worker user.
const verifyAdmin = (req, res, next) => {
    if (!req.user || !req.user.role) {
        return res.status(401).json({
            success: false,
            message: "Access denied. Authentication required."
        });
    }

    const role = String(req.user.role).toLowerCase();
    if (role !== "worker" && role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Worker privileges required."
        });
    }

    next();
};

module.exports = verifyAdmin;
