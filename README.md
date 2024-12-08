BookMySession
BookMySession is a web application that allows users to manage and book speaker sessions seamlessly. The application provides an intuitive platform for session management with features such as user authentication, profile setup, and slot booking.

---

## **Technologies Used**

- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Authentication**: JWT, Bcrypt
- **Frontend**: (Planned for future development)
- **Environment Management**: dotenv

---

## Authentication and Authorization

### a. User and Speaker Signup
Signup for Users and Speakers:
- Both users and speakers can create profiles using basic details such as:
  - First Name
  - Last Name
  - Email Address
  - Password
- During the signup process, an **OTP (One-Time Password)** is sent to the user's email address to verify the account. This ensures that only valid email addresses are used.

### b. OTP Verification
- After submitting their signup details, users and speakers will receive an OTP to their provided email address.
- The user must enter the OTP on the application to verify their email and complete the signup process. This step ensures that the email provided is valid and that the user is not a bot.

### c. Login Authentication
- After account creation and OTP verification, both users and speakers can log in with their credentials (email and password).
  - **Password Authentication**: The password is securely stored and compared with the hash stored in the database to authenticate the user.
- Upon successful login, a **JWT (JSON Web Token)** is generated and returned to the client.
  - The JWT token is used for subsequent requests to access protected routes.
  - This token is sent in the request headers for authenticated routes (i.e., routes that require login).

### d. Authorization - Role-Based Access Control (RBAC)
Middleware for Role-Based Access:
- The authentication token is validated using a middleware before accessing any protected route.
- Based on the user type (user or speaker), the middleware will verify the user's role and grant access to specific endpoints:
  - **Users**: Can only access routes related to viewing speakers, booking sessions, and their own session details.
  - **Speakers**: Can only access routes related to setting up their profiles, listing their expertise, and managing their availability.

### e. Protected Routes
- Any route that requires authentication (like booking a session or listing a speaker profile) is protected and can only be accessed if the correct token is provided in the request headers.
- The middleware checks the token's validity and the user's role before allowing access to the route.

---
## Session Booking Process

### a. Booking a Slot
- Users can browse through the list of available **speakers** and choose a session slot that fits their schedule.
- **Time Slot Availability**: Speakers define time slots between **9 AM and 4 PM**, with each slot being available in **1-hour intervals**.
- **Booking Process**:
  - To book a session, the user must be logged in.
  - Once logged in, users can select an available time slot for a session with their chosen speaker.
  
### b. One-Time Slot Booking Rule
- **Double Booking Prevention**: Each user is only allowed to book **one session per time slot**.
  - If the user has already booked a session in a specific time slot, they are prevented from booking it again.
  - This ensures that each user can only have one booking per session.

### c. Multiple Users per Slot
- **Multiple User Bookings per Slot**: Although only one session can be booked per user in a specific time slot, **multiple users** can book the same slot.
  - This means that different users can attend the same session, provided they have booked the slot, but a single user cannot book the same time slot multiple times.

### d. Slot Blocking for Double Booking
- When a user successfully books a session, the corresponding time slot is **blocked** for that day to prevent double booking by the same user.
- This ensures that once a user books a session, the slot is unavailable for re-booking by the same user.

---

## Email Notifications

### a. Email Notification upon Booking
- Once a user successfully books a session with a speaker, an **email notification** is sent to both the user and the speaker.
  - This ensures that both parties are notified about the successful booking.
  - The email includes details such as:
    - Speaker Name
    - Session Time and Date
    - Session Topic/Expertise

### b. Email Configuration
- The email notification is sent using an **SMTP service** (e.g., **Nodemailer** with an SMTP provider like Gmail, SendGrid, or Mailgun).
- The backend sends the email after a successful booking event, including relevant session and user details.

### c. Customization
- The email content is customized to provide a professional and user-friendly experience, with clear instructions about the session booking.

---

## Google Calendar Integration

### a. Google Calendar Invite upon Booking
- After a session is successfully booked, a **Google Calendar event** is created and added to both the user's and speaker's calendars.
  - This ensures both parties are reminded of the upcoming session.

### b. Google Calendar API
- The Google Calendar event is created using the **Google Calendar API**.
  - The event includes the session's:
    - Date and Time
    - Speaker's Name
    - Session Description
  - Both the user and the speaker are invited to the event and will receive calendar reminders.

### c. OAuth for Google Calendar Integration
- To create and manage Google Calendar events, the application integrates with the **Google API** using **OAuth2** for authentication and authorization.
  - This allows the app to authenticate and authorize users (and speakers) to access and modify their Google Calendars for event creation.

### d. Calendar Invite Details
- The invite includes:
  - Session time, date, and location (if any)
  - Reminders for the event
  - A link to the session if applicable (e.g., a Zoom link or a physical location)

# API Documentation

## 1. User Signup
**Endpoint:** `POST /signup`  
**Description:**  
This endpoint allows a user (either a general user or a speaker) to sign up by providing their basic information (first name, last name, email, password, and role). An OTP (One-Time Password) is sent to the provided email for verification.

### Request Body:
```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "password": "string",
  "role": "string"  // 'user' or 'speaker'
}
```
### Response:
- **Status 200:** Success message and the user ID.
```json
{
  "message": "OTP has been sent to your email. Please check your inbox, and if you do not see it, check your spam folder for the verification email.",
  "userId": "integer"
}
```
- **Status 400:** If the email is already registered.
```json
Copy code
{
  "error": "Email is already registered."
}
```
- **Status 500:** If there is an error during signup.
```json
Copy code
{
  "error": "Signup failed. Please try again later."
}
```
## 2. OTP Verification
**Endpoint:** `POST /verify-otp`
**Description:**
This endpoint allows the user to verify their email by entering the OTP sent to them during the signup process.

### Request Body:
```json
Copy code
{
  "userId": "integer",  // ID of the user who is verifying their email
  "otp": "string"       // OTP sent to the user's email
}
```
### Response:
- **Status 200:** Success message after successful OTP verification.
```json
Copy code
{
  "message": "Account verified successfully."
}
```
- **Status 400:** If the OTP is invalid or expired.
```json
Copy code
{
  "error": "Invalid OTP." // or "OTP has expired."
}
```
- **Status 404:** If the user is not found.
```json
Copy code
{
  "error": "User not found."
}
```
- **Status 500:** If there is an error during OTP verification.
```json
Copy code
{
  "error": "OTP verification failed. Please try again later."
}
```
## 3. User Login
**Endpoint:** `POST /login`
**Description:**
This endpoint allows a user (either a general user or a speaker) to log in using their email and password. A JWT (JSON Web Token) is returned upon successful authentication.

### Request Body:
```json
Copy code
{
  "email": "string",
  "password": "string"
}
```
### Response:
- **Status 200:** Success message with the JWT token.
```json
Copy code
{
  "message": "Login successful.",
  "jwtToken": "string"  // JWT token
}
```
- **Status 400:** If the email or password is incorrect, or the account is not verified.
```json
Copy code
{
  "error": "Invalid email or password." // or "Account not verified. Please verify your account first."
}
```
- **Status 500:** If there is an error during login.
```json
Copy code
{
  "error": "Login failed. Please try again later."
}
```
### Notes:
The JWT token is used for authenticating subsequent requests to protected routes.
The user must be verified before they can log in.
The email OTP expires after 10 minutes, after which the user must request a new OTP.
### Contact:
For any queries or issues, reach out at:

Email: ujjawalkantt@example.com
GitHub: Ujjawal Kantt
