# Job Orbit Backend

This repository contains the backend code for the Job Orbit project.


## Installation

To get started with the backend, follow these steps:

1. Clone the repository:
    ```bash
    git clone https://github.com/ShivaBollam07/Job-Orbit---Backend
    cd backend
    ```

2. Install the required libraries:
    ```bash
    npm install
    ```

3. Add a `config.env` file in the root directory with the following keys 

    ```plaintext
    backend_port=3000
    SQL_DB_HOST=localhost
    SQL_DB_USER=
    SQL_DB_PASSWORD=
    SQL_DB_NAME=
    SQL_DB_PORT=5432
    JWT_SECRET_KEY=
    JWT_EXPRIES_TIME=1000000000
    google_user_mail=
    google_user_app_password=
    ```


## Running the Server

To run the server, use the following command:

```bash
nodemon server.js


