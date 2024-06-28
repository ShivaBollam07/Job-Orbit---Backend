const express = require('express');
const router = express.Router();
const { signup, login, updateProfile, changePassword, deleteAccount, useralldetails,alldetailsofauserbyuserid, getuserdetailsbasedonuserid } = require('../Controllers/authController');
const jwtTokenVerification = require('../Middleware/jwtTokenVerification');

router.route('/signup').
    post(signup);
router.route('/login').
    post(login);
router.route('/profile/update').
    put(jwtTokenVerification, updateProfile);
router.route('/profile/change-password')
    .put(jwtTokenVerification, changePassword);
router.route('/profile/delete')
    .delete(jwtTokenVerification, deleteAccount);
router.route('/profile/getDetails')
    .get(jwtTokenVerification, useralldetails);
router.route('/profile/getDetailsById')
    .get(jwtTokenVerification, getuserdetailsbasedonuserid);
router.route('/profile/getDetailsByIdOfUser')
    .post(jwtTokenVerification, alldetailsofauserbyuserid);

module.exports = router;
