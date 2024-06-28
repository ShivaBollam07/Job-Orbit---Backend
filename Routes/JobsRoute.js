const express = require('express');
const router = express.Router();
const JobsController = require('../Controllers/jobsController');
const jwtTokenVerification = require('../Middleware/jwtTokenVerification');

router.route('/getAllJobs')
    .get(jwtTokenVerification, JobsController.getAllJobs);

router.route('/applyJob')
    .post(jwtTokenVerification, JobsController.applyJob);

module.exports = router;
