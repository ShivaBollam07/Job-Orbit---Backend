const ResponseSender = (res, statusCode, status, message, token, email, timeLeft) => {
    res.status(statusCode).json({
        status: status,
        message: message,
        token: token,
        email: email,
        timeLeft: timeLeft,
    });
};

module.exports = ResponseSender;
