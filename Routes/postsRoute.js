const express = require('express');
const router = express.Router();
const PostsController = require('../Controllers/postsController');
const jwtTokenVerification = require('../Middleware/jwtTokenVerification');

router.route('/create')
    .post(jwtTokenVerification, PostsController.createPost);
router.route('/user/:userId')
    .get(jwtTokenVerification, PostsController.getPostsByUser);
router.route('/feed')
    .get(jwtTokenVerification, PostsController.getPostsFeed);
router.route('/delete/:postId')
    .delete(jwtTokenVerification, PostsController.deletePost);
router.route('/postDetails')
    .post(jwtTokenVerification, PostsController.getUserDetailsbyPostId);
    
module.exports = router;
