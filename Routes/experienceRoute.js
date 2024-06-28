const express = require('express');
const router = express.Router();
const experienceController = require('../Controllers/experienceController');
const jwtTokenVerification = require('../Middleware/jwtTokenVerification');

router.route('/details')
    .post(jwtTokenVerification, experienceController.addExperienceWithCompanyAndSkills)
    .put(jwtTokenVerification, experienceController.updateExperienceById)
    .delete(jwtTokenVerification, experienceController.deleteExperience);

router.route('/details/:userId')
    .get(jwtTokenVerification, experienceController.getExperienceDetailsByUserId);


module.exports = router;
