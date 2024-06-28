const CatchErrorFunction = (res,error) => {
    res.status(500).json({
        status: "failed",
        message: error.message,
    });
}

module.exports = CatchErrorFunction;