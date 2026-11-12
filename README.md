# AgriLedger ERP

Migration workspace for the AgriLedger agricultural retail ERP.

## Target architecture

- Frontend: Angular 19, PrimeNG 19, SCSS
- Backend: Java Spring Boot REST API
- Database: PostgreSQL with Flyway migrations
- Authentication: JWT and role-based access control

## Current migration package

The migration package prepared for this project is `agriledger-angular-migration.zip`. It contains the Angular application foundation, Spring Boot API foundation, database migrations, and migration notes. This package has not yet been fully built or end-to-end tested; the original React business workflows still require migration and verification.

## Repository status

This repository is initialized. The source ZIP has **not** yet been uploaded as repository files. Do not treat this repository as a deployable production build until the full source is committed and frontend/backend builds and workflows are verified.

## Local setup

See the package README and backend/frontend manifests for setup commands and required environment variables once the source archive is extracted into this repository.
