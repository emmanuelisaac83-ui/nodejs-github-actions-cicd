# Node.js CI/CD Deployment on AWS EC2

## 1. Project Overview

This project demonstrates an automated Continuous Integration and Continuous Deployment (CI/CD) pipeline for a Node.js and Express web application hosted on Amazon EC2.

GitHub Actions runs automated tests and dependency security checks. A separate deployment workflow authenticates to AWS using OpenID Connect (OIDC) and uses AWS Systems Manager (SSM) Run Command to deploy the latest code to an EC2 instance.

The application runs on Ubuntu, uses Nginx as a reverse proxy, and is managed through systemd.

**GitHub Repository:** https://github.com/emmanuelisaac83-ui/nodejs-github-actions-cicd

## 2. Project Objectives

- Deploy a Node.js and Express application to Amazon EC2.
- Automate testing and dependency auditing with GitHub Actions.
- Automate application deployment following changes to the main branch.
- Use GitHub OIDC for temporary AWS authentication instead of storing long-lived AWS access keys.
- Use AWS Systems Manager to execute deployment commands remotely.
- Configure Nginx as a reverse proxy for the application.
- Implement application and web-server health checks.
- Troubleshoot deployment failures and verify the final application.

## 3. Technologies Used

| Technology | Purpose |
|---|---|
| Amazon EC2 | Hosts the application |
| Amazon VPC | Provides network isolation |
| Ubuntu Server 24.04 LTS | Server operating system |
| Node.js 24 | JavaScript runtime |
| Express | Web application framework |
| EJS | Server-rendered HTML templates |
| Nginx | HTTP entry point and reverse proxy |
| systemd | Manages the Node.js application service |
| Git and GitHub | Source control and repository hosting |
| GitHub Actions | Continuous integration and deployment automation |
| AWS IAM and OIDC | Secure federated authentication |
| AWS Systems Manager | Remote execution of deployment commands |
| npm | Dependency installation, testing, and auditing |

## 4. Architecture

### Application request flow

Browser → EC2 public HTTP endpoint (port 80) → Nginx → Node.js/Express (port 3000)

### Deployment flow

Developer pushes code to GitHub → GitHub Actions authenticates to AWS using OIDC → AWS Systems Manager Run Command executes the deployment script on EC2 → application dependencies are installed → systemd restarts the application → health checks verify the application and Nginx.

### AWS networking

The lab uses a custom VPC with a public subnet, internet gateway, route table, and security group. The EC2 instance hosts the application and is managed through AWS Systems Manager.

## 5. AWS Infrastructure

The project was deployed in the `us-east-1` region.

| Resource | Configuration |
|---|---|
| VPC | `NodeJS-CICD-VPC`, CIDR `10.0.0.0/16` |
| Public subnet | `NodeJS-Public-Subnet`, CIDR `10.0.1.0/24` |
| Internet gateway | `NodeJS-IGW` |
| Route table | `NodeJS-Public-RT`, with a default route to the internet gateway |
| EC2 instance | `NodeJS-CICD-Server`, Ubuntu 24.04 LTS, `t3.micro` |
| Root volume | 8 GiB gp3 |
| Security group | `NodeJS-CICD-SG` |
| EC2 instance IAM role | `NodeJS-CICD-SSM-Role` |
| GitHub deployment IAM role | `GitHub-NodeJS-CICD-Deploy-Role` |

The instance security group allowed HTTP access on port 80. SSH access was restricted to the administrator's IP during setup rather than exposed to all IP addresses.

The EC2 instance role included `AmazonSSMManagedInstanceCore` to support Systems Manager management.

## 6. Continuous Integration Workflow

Workflow file: `.github/workflows/ci.yml`

The CI workflow runs on pushes and pull requests targeting `main`.

Its steps are:

1. Check out the repository.
2. Configure Node.js 24.
3. Enable npm dependency caching.
4. Install dependencies using `npm ci`.
5. Run automated tests using `npm test`.
6. Check dependency security using `npm audit`.

This workflow helps identify test failures and dependency vulnerabilities before changes are accepted.

## 7. Continuous Deployment Workflow

Workflow file: `.github/workflows/cd.yml`

The deployment workflow runs on pushes to `main` and can also be started manually through GitHub Actions.

### Authentication

The workflow uses `aws-actions/configure-aws-credentials@v4` to assume an AWS IAM role using GitHub OIDC.

The workflow requests permission to obtain an OIDC token and read repository contents. It does not require a long-lived AWS access key stored in GitHub.

Repository configuration:

- Secret: `AWS_DEPLOY_ROLE_ARN`
- Variable: `EC2_INSTANCE_ID`
- AWS region: `us-east-1`

The AWS IAM trust policy should restrict role assumption to the intended repository and branch or environment. Deployment permissions should be limited to the required Systems Manager actions and target instance.

### Deployment steps

The workflow:

1. Creates a deployment shell script.
2. Sends the script to the target EC2 instance using the `AWS-RunShellScript` Systems Manager document.
3. Corrects application-directory ownership and configures Git's safe-directory setting for the Ubuntu user.
4. Fetches the latest `main` branch and resets the deployment directory to `origin/main`.
5. Installs production dependencies using `npm ci --omit=dev`.
6. Restarts the `nodejs-app` systemd service.
7. Retries the application health check against `http://127.0.0.1:3000/`.
8. Retries the Nginx health check against `http://127.0.0.1/`.
9. Checks the Systems Manager command result and fails the workflow if the command fails or times out.

The deployment uses bounded retries rather than assuming that the application will be ready immediately after a service restart.

## 8. Application Configuration

The Node.js application uses Express and EJS to render its home page.

The application is managed by the `nodejs-app` systemd service and listens on port 3000. Nginx accepts HTTP requests on port 80 and proxies them to the local application.

The home page identifies the project as a Node.js CI/CD deployment demonstration, describes the AWS and automation technologies used, and links to the source repository.

## 9. Testing and Verification

During final verification:

- The local Node.js automated test suite passed.
- `npm audit` reported zero vulnerabilities at the time of the check.
- The latest GitHub Actions run completed successfully.
- The updated application was verified in a browser through the public HTTP endpoint.
- The home page displayed the updated project description and repository link.

These results reflect the state of the project at the time of testing. Run the tests and audit again before future deployments.

## 10. Troubleshooting and Lessons Learned

### A. Git repository ownership and safe-directory errors

**Issue:** Git reported a repository ownership or “dubious ownership” safety error.

**Resolution:** Corrected the ownership/trust configuration and ran Git commands as the appropriate user.

**Lesson:** Consistent ownership and the correct operating-system user are important when automating deployments.

### B. Git file-permission errors

**Issue:** Git operations encountered permission problems, including a `FETCH_HEAD` permission error.

**Resolution:** Corrected ownership and performed repository operations as the intended user.

**Lesson:** Avoid mixing root and Ubuntu ownership within the same application directory.

### C. Non-interactive Systems Manager execution

**Issue:** Commands executed through Systems Manager behaved differently from commands run in an interactive SSH session.

**Resolution:** Made the execution environment explicit, including the `HOME` environment variable, and checked user permissions.

**Lesson:** Deployment automation must account for the environment in which remote commands execute.

### D. Nginx 502 Bad Gateway

**Issue:** Nginx returned a 502 response when the Node.js upstream service was temporarily unavailable during a restart.

**Resolution:** Checked the systemd service and the application listener on port 3000, then verified the application and Nginx endpoints after startup.

**Lesson:** Nginx being active does not guarantee that the application behind it is ready to receive requests.

### E. Application startup and health checks

**Issue:** The application needed time to start before the health checks could pass.

**Resolution:** Added bounded retry loops for the application and Nginx endpoints, followed by final checks that fail the deployment if the endpoints remain unavailable.

**Lesson:** Deployment pipelines should wait for service readiness while still reporting failures clearly.

### F. Tests no longer matched the updated home page

**Issue:** Updating the page content required corresponding updates to test assertions.

**Resolution:** Updated the automated tests to verify the intended page content and reran the test suite.

**Lesson:** Automated tests should evolve with intentional application changes.

### G. Git push rejected because the remote branch had advanced

**Issue:** A push was rejected because the remote `main` branch contained newer commits.

**Resolution:** Ran `git pull --rebase origin main`, then pushed the updated branch successfully.

**Lesson:** Synchronize local and remote branch history before pushing when the remote has advanced.

### H. Final deployment verification

**Issue:** A successful workflow alone was not sufficient evidence that the intended version was available to users.

**Resolution:** Verified the successful GitHub Actions run and opened the updated application in a browser.

**Lesson:** Verify both the deployment pipeline and the application endpoint.

## 11. Evidence for Assessment

Include genuine screenshots in the repository, preferably in an `evidence/` directory:

1. Successful GitHub Actions CI/CD run.
2. Updated application loaded in a browser.
3. GitHub commit history showing project changes.
4. AWS networking and EC2 configuration, if required by the assessment.
5. Relevant deployment or health-check output, with sensitive values redacted.

Only include screenshots that were actually captured. Never commit private keys, credentials, access tokens, or other secrets.

## 12. Security Considerations

- Use GitHub OIDC for federated authentication to AWS.
- Restrict the deployment IAM role to the intended repository, branch or environment, and required actions.
- Limit Systems Manager deployment permissions to the target instance and approved commands.
- Avoid exposing SSH to `0.0.0.0/0`.
- Prefer Systems Manager for server administration where practical.
- Keep secrets out of source code and screenshots.
- Review IAM policies and security-group rules before production use.

This is a learning project and should not be treated as a production security certification.

## 13. AWS Cleanup and Reproduction

The AWS infrastructure is used for demonstration and can be recreated for the planned walkthrough video.

Before deleting resources, preserve the GitHub repository, README, source code, workflow files, project report, and genuine assessment screenshots.

Delete only resources created for this lab, after checking dependencies. Review the AWS Billing console before and after cleanup. Depending on the account's terms, compute, storage, public IPv4 addresses, and other resources may incur charges.

The GitHub repository and its documentation are independent of the EC2 environment and should be retained.

## 14. Skills Demonstrated

- AWS VPC networking and security groups
- EC2 and Ubuntu administration
- Nginx reverse-proxy configuration
- Node.js application hosting and systemd
- Git and GitHub version control
- GitHub Actions CI/CD
- IAM roles and OIDC federation
- AWS Systems Manager Run Command
- Automated testing and dependency auditing
- Health checks, service recovery, and deployment troubleshooting

## 15. Conclusion

This project demonstrates an automated path from a code change in GitHub to testing, secure AWS authentication, remote deployment, service restart, and health-check verification on Amazon EC2.

It also provided practical experience resolving Linux permission issues, managing Git synchronization, handling application startup delays, troubleshooting reverse-proxy failures, and verifying the deployed version.

**Repository:** https://github.com/emmanuelisaac83-ui/nodejs-github-actions-cicd
