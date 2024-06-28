const express = require('express');
const router = express.Router();
const educationController = require('../Controllers/educationController');
const jwtTokenVerification = require('../Middleware/jwtTokenVerification');

router.route('/details')
    .post(jwtTokenVerification, educationController.addEducationWithInstitutionAndSkills)
    .put(jwtTokenVerification, educationController.updateEducationById)
    .delete(jwtTokenVerification, educationController.deleteEducation);

router.route('/details/:userId')
    .get(jwtTokenVerification, educationController.getEducationDetailsByUserId);

router.route('/skills/educationId')
    .get(jwtTokenVerification, educationController.getSkillsBasedOnEducationIdandallskillsbasesonExperienceId);
    

module.exports = router;
