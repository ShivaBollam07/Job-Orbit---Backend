const express = require('express');
const router = express.Router();
const LikesController = require('../Controllers/likesController');
const jwtTokenVerification = require('../Middleware/jwtTokenVerification');

router.route('/like/:postId')
    .post(jwtTokenVerification, async (req, res) => {
        const postId = req.params.postId;
        const userId = req.user.userId;
        const liked = await LikesController.isLiked(postId, userId);
        if (liked) {
            return LikesController.unlikePost(req, res);
        }
        LikesController.likePost(req, res);
    });

router.route('/unlike/:postId')
    .delete(jwtTokenVerification, LikesController.unlikePost);

router.route('/post/:postId')
    .get(jwtTokenVerification, LikesController.getLikesForPost);



module.exports = router;
