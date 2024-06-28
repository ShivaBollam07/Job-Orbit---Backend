const { pool } = require('../Config/dbConfig');


const addExperienceWithCompanyAndSkills = async (req, res) => {
    const client = await pool.connect();
    try {
        const { branch, job_role, company, startDate, endDate, description, skills } = req.body;
        const userId = req.user.userId;

        // Log the incoming request data
        console.log('Request body:', req.body);
        console.log('User ID:', userId);

        // Validate the incoming data
        if (!branch || !job_role || !company || !startDate || !endDate || !description) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        await client.query('BEGIN');

        // Add company and get companyId
        const companyId = await addCompany(company, branch, client);

        // Insert experience details
        const insertExperienceQuery = `
            INSERT INTO ExperienceDetails (user_id, company_id, job_role, start_date, end_date, description)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING experience_id`;
        const experienceResult = await client.query(insertExperienceQuery, [userId, companyId, job_role, startDate, endDate, description]);

        const experienceId = experienceResult.rows[0].experience_id;

        // Ensure skills is an array
        let skillsArray = [];
        if (typeof skills === 'string') {
            skillsArray = skills.split(',').map(skill => skill.trim());
        } else if (Array.isArray(skills)) {
            skillsArray = skills;
        }

        if (skillsArray.length > 0) {
            const skillInsertPromises = skillsArray.map(async (skillName) => {
                let skillId;
                const checkSkillQuery = `
                    SELECT skill_id FROM Skills WHERE skill_name = $1`;
                const checkSkillResult = await client.query(checkSkillQuery, [skillName]);

                if (checkSkillResult.rows.length > 0) {
                    skillId = checkSkillResult.rows[0].skill_id;
                } else {
                    const insertSkillQuery = `
                        INSERT INTO Skills (skill_name)
                        VALUES ($1)
                        RETURNING skill_id`;
                    const skillResult = await client.query(insertSkillQuery, [skillName]);
                    skillId = skillResult.rows[0].skill_id;
                }

                const insertExperienceSkillQuery = `
                    INSERT INTO ExperienceSkills (experience_id, skill_id)
                    VALUES ($1, $2)`;
                await client.query(insertExperienceSkillQuery, [experienceId, skillId]);
            });

            await Promise.all(skillInsertPromises);
        }

        await client.query('COMMIT');

        res.status(201).json({ message: 'Experience details added successfully', experienceId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error adding experience details:', err.message, err.stack);
        res.status(500).json({ error: 'Error adding experience details' });
    } finally {
        client.release();
    }
};

const getSkillsBasedOnExperienceId = async (experienceId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT s.skill_name
            FROM Skills s
            JOIN ExperienceSkills es ON s.skill_id = es.skill_id
            WHERE es.experience_id = $1`;

        const { rows } = await client.query(query, [experienceId]);
        return rows;
    } catch (error) {
        console.error('Error fetching skills based on experience id:', error);
        throw error; // Throw the error to handle it in the calling function or route handler
    } finally {
        client.release();
    }
};

const updateExperienceById = async (req, res) => {
    const client = await pool.connect();
    try {
        const { experienceId, branch, job_role, company, startDate, endDate, description, skills } = req.body;
        const userId = req.user.userId;

        await client.query('BEGIN');

        // Check if the user is authorized to update this experience
        const checkOwnershipQuery = `
            SELECT user_id FROM ExperienceDetails WHERE experience_id = $1`;
        const checkOwnershipResult = await client.query(checkOwnershipQuery, [experienceId]);

        if (checkOwnershipResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Experience details not found' });
        }

        if (checkOwnershipResult.rows[0].user_id !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'You are not authorized to update this experience' });
        }

        let companyId = null;

        if (company && branch) {
            companyId = await addCompany(company, branch, client);
        } else {
            const getCurrentCompanyQuery = `
                SELECT company_id FROM ExperienceDetails WHERE experience_id = $1`;
            const currentCompanyResult = await client.query(getCurrentCompanyQuery, [experienceId]);

            if (currentCompanyResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Experience details not found' });
            }

            companyId = currentCompanyResult.rows[0].company_id;
        }

        await updateExperienceDetails(client, experienceId, userId, companyId, job_role, startDate, endDate, description);

        // Update experience skills
        await updateExperienceSkills(client, experienceId, skills);

        await client.query('COMMIT');

        res.status(200).json({ message: 'Experience details updated successfully', experienceId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating experience details:', err);
        res.status(500).json({ error: 'Error updating experience details' });
    } finally {
        client.release();
    }
};

const updateExperienceDetails = async (client, experienceId, userId, companyId, job_role, startDate, endDate, description) => {
    const updateExperienceQuery = `
        UPDATE ExperienceDetails
        SET company_id = $1,
            job_role = COALESCE($2, job_role),
            start_date = COALESCE($3, start_date),
            end_date = COALESCE($4, end_date),
            description = COALESCE($5, description)
        WHERE experience_id = $6 AND user_id = $7`;
    await client.query(updateExperienceQuery, [companyId, job_role, startDate, endDate, description, experienceId, userId]);
};

const updateExperienceSkills = async (client, experienceId, skills) => {
    // Delete existing skills
    const deleteExistingSkillsQuery = `
        DELETE FROM ExperienceSkills
        WHERE experience_id = $1`;
    await client.query(deleteExistingSkillsQuery, [experienceId]);

    // Insert new skills
    await insertExperienceSkills(client, experienceId, skills);
};

const insertExperienceSkills = async (client, experienceId, skills) => {
    if (skills && skills.length > 0) {
        const skillInsertPromises = skills.map(async (skillName) => {
            // Check if skill already exists
            let skillId;
            const checkSkillQuery = `
                SELECT skill_id FROM Skills WHERE skill_name = $1`;
            const checkSkillResult = await client.query(checkSkillQuery, [skillName]);

            if (checkSkillResult.rows.length > 0) {
                skillId = checkSkillResult.rows[0].skill_id;
            } else {
                // Insert new skill if it doesn't exist
                const insertSkillQuery = `
                    INSERT INTO Skills (skill_name)
                    VALUES ($1)
                    RETURNING skill_id`;
                const skillResult = await client.query(insertSkillQuery, [skillName]);
                skillId = skillResult.rows[0].skill_id;
            }

            // Insert into ExperienceSkills junction table
            const insertExperienceSkillQuery = `
                INSERT INTO ExperienceSkills (experience_id, skill_id)
                VALUES ($1, $2)`;
            await client.query(insertExperienceSkillQuery, [experienceId, skillId]);
        });

        await Promise.all(skillInsertPromises);
    }
};

const deleteExperience = async (req, res) => {
    const client = await pool.connect();
    try {
        const { experienceId } = req.body; // Assuming you pass experienceId in the request body
        const userId = req.user.userId;

        if (!experienceId) {
            return res.status(400).json({ error: 'Experience ID is required to delete experience details' });
        }

        await client.query('BEGIN');

        // Check if the experience belongs to the user
        const getExperienceUserIdQuery = `
            SELECT user_id FROM ExperienceDetails WHERE experience_id = $1`;
        const { rows } = await client.query(getExperienceUserIdQuery, [experienceId]);

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Experience details not found' });
        }

        if (rows[0].user_id !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'You are not authorized to delete this experience' });
        }

        // Delete associated skills first
        const deleteExperienceSkillsQuery = `
            DELETE FROM ExperienceSkills
            WHERE experience_id = $1`;
        await client.query(deleteExperienceSkillsQuery, [experienceId]);

        // Then delete the experience details
        const deleteExperienceQuery = `
            DELETE FROM ExperienceDetails
            WHERE experience_id = $1`;
        await client.query(deleteExperienceQuery, [experienceId]);

        await client.query('COMMIT');

        res.status(200).json({ message: 'Experience details deleted successfully', experienceId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting experience details:', err);
        res.status(500).json({ error: 'Error deleting experience details' });
    } finally {
        client.release();
    }
};

const addCompany = async (name, branch, client) => {
    let companyId;

    const checkCompanyQuery = `
        SELECT company_id FROM Company WHERE name = $1 AND branch = $2`;
    const checkCompanyResult = await client.query(checkCompanyQuery, [name, branch]);

    if (checkCompanyResult.rows.length > 0) {
        companyId = checkCompanyResult.rows[0].company_id;
    } else {
        const insertCompanyQuery = `
            INSERT INTO Company (name, branch)
            VALUES ($1, $2)
            RETURNING company_id`;
        const companyResult = await client.query(insertCompanyQuery, [name, branch]);
        companyId = companyResult.rows[0].company_id;
    }

    return companyId;
};

const getExperienceDetailsByUserId = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.params.userId;

        const query = `
            SELECT 
                ed.experience_id,
                ed.user_id,
                ed.job_role,
                ed.start_date,
                ed.end_date,
                ed.description,
                comp.name AS company_name,
                comp.branch AS company_branch,
                ARRAY_AGG(s.skill_name) AS skills
            FROM 
                ExperienceDetails ed
            JOIN 
                Company comp ON ed.company_id = comp.company_id
            LEFT JOIN 
                ExperienceSkills es ON ed.experience_id = es.experience_id
            LEFT JOIN 
                Skills s ON es.skill_id = s.skill_id
            WHERE 
                ed.user_id = $1
            GROUP BY 
                ed.experience_id, comp.name, comp.branch
            ORDER BY 
                ed.start_date DESC`;

        const { rows } = await client.query(query, [userId]);

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching experience details:', error);
        res.status(500).json({ error: 'Error fetching experience details' });
    } finally {
        client.release();
    }
};

module.exports = { getExperienceDetailsByUserId };

module.exports = {getSkillsBasedOnExperienceId,  addExperienceWithCompanyAndSkills, updateExperienceById, deleteExperience, getExperienceDetailsByUserId };
