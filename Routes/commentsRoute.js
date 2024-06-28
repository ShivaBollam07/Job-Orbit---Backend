const express = require('express');
const router = express.Router();
const CommentsController = require('../Controllers/commentsController');
const jwtTokenVerification = require('../Middleware/jwtTokenVerification');

router.route('/add')
    .post(jwtTokenVerification, CommentsController.addComment);

router.route('/post/getComments')
    .post(jwtTokenVerification, CommentsController.getCommentsByPostandalsocommenteduserdetails);

router.route('/user/comments')
    .get(jwtTokenVerification, CommentsController.getCommentsByUserId);



module.exports = router;
