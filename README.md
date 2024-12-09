### BookMySession
BookMySession is a web application that allows users to manage and book speaker sessions seamlessly. The application provides an intuitive platform for session management with features such as user authentication, profile setup, and slot booking.

This project is an assignment from Proactive to showcase skills in building backend applications using Node.js, Express, and JWT authentication.

The detailed API documentation for **BookMySession** is provided below. If you wish to run the APIs directly through Postman, you can [view and fork the collection here](https://www.postman.com/ujjawal06/976a370d-1db1-4971-aa87-454b82e87396/documentation/pd5der9/bookmysession). 

To interact with the APIs:
1. Fork the collection to your own Postman workspace.
2. Use the provided environment variables (if any) and authentication tokens to hit the endpoints directly from Postman.

**Note:** The backend is deployed on Render, and it may take some time to respond on the first API call as it goes idle if not used for a while (since it's on the free tier).


---

## **Technologies Used**

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL, Supabase
- **Authentication**: JWT, Bcrypt, Oauth2.0
- **Mail**: Nodemailer, Gmail
- **Calendar**: Google Calendar API
- **Environment Management**: dotenv

---
## **Database Schema**

The **BookMySession** application uses a relational database to manage users, speaker profiles, session bookings, and available time slots. Below is the schema for the database.

### Users Table
Stores information about the users (both speakers and general users).

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,           -- Unique user ID
    first_name TEXT NOT NULL,        -- User's first name
    last_name TEXT NOT NULL,         -- User's last name
    password TEXT NOT NULL,          -- User's encrypted password
    otp TEXT NOT NULL,               -- OTP sent for email verification
    is_verified BOOLEAN DEFAULT FALSE, -- Whether the user's email is verified
    email TEXT UNIQUE NOT NULL,      -- User's unique email
    role TEXT CHECK (role IN ('user', 'speaker')) NOT NULL  -- Role of the user (user or speaker)
);
```
#### Columns:
   - id: Unique identifier for each user.
   - first_name: User’s first name.
   - last_name: User’s last name.
   - password: Encrypted password for login.
   - otp: One-time password used for email verification.
   - is_verified: Flag indicating whether the user has verified their email.
   - email: Unique email for the user.
   - role: Defines whether the user is a general user (user) or a speaker (speaker).

## Bookings Table
Stores the booking details for sessions, associating users with time slots and speakers.
```sql
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,            -- Unique booking ID
    user_id INT REFERENCES users(id) ON DELETE CASCADE,  -- User who booked the session
    slot_id INT REFERENCES time_slots(id) ON DELETE CASCADE, -- Time slot being booked
    speaker_profile_id INT REFERENCES speaker_profiles(id) ON DELETE CASCADE, -- Speaker's profile
    booking_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,    -- Time when the booking was made
    CONSTRAINT unique_user_slot UNIQUE (user_id, slot_id) -- Ensure a user can book a slot only once
);
```
#### Columns:
   - id: Unique identifier for each booking.
   - user_id: Foreign key referencing the users table, identifying the user who made the booking.
   - slot_id: Foreign key referencing the time_slots table, indicating the booked time slot.
   - speaker_profile_id: Foreign key referencing the speaker_profiles table, identifying the speaker associated with the session.
   - booking_time: The timestamp of when the booking was made.

## Speaker Profiles Table
Stores speaker-specific information like their expertise and session price.

```sql
CREATE TABLE speaker_profiles (
    id SERIAL PRIMARY KEY,                  -- Unique speaker profile ID
    speaker_id INT REFERENCES users(id) ON DELETE CASCADE, -- Foreign key to users table
    expertise TEXT NOT NULL,                 -- Speaker's area of expertise
    price_per_session NUMERIC NOT NULL      -- Price for one session
);
```
#### Columns:

   - id: Unique identifier for the speaker profile.
   - speaker_id: Foreign key referencing the users table, indicating the speaker's user ID.
   - expertise: The area of expertise for the speaker (e.g., Web Development, AI, etc.).
   - price_per_session: Price charged by the speaker per session.
T
## Time Slots Table
Stores the available time slots for speakers to manage their availability.

``` sql
CREATE TABLE time_slots (
    id SERIAL PRIMARY KEY,                    -- Unique time slot ID
    speaker_profile_id INT REFERENCES speaker_profiles(id) ON DELETE CASCADE, -- Foreign key to speaker_profiles
    user_id INT REFERENCES users(id) ON DELETE SET NULL,  -- Foreign key to users, NULL if not booked
    slot_start TIMESTAMP NOT NULL,             -- Start time of the slot
    slot_end TIMESTAMP NOT NULL,               -- End time of the slot
    is_booked BOOLEAN DEFAULT FALSE,           -- Availability status of the slot
    CONSTRAINT unique_slot_per_user UNIQUE (user_id, slot_start)  -- Ensure a user can only book one slot per time
);
```
#### Columns:
   - id: Unique identifier for each time slot.
   - speaker_profile_id: Foreign key referencing the speaker_profiles table, identifying which speaker the time slot belongs to.
   - user_id: Foreign key referencing the users table, indicating the user who booked the slot (NULL if not booked).
   - slot_start: The start time of the available time slot.
   - slot_end: The end time of the available time slot.
   - is_booked: Indicates whether the slot is currently booked.
   - unique_slot_per_user: Ensures that a user cannot book the same slot more than once.

---

# Table of Contents

1. Introduction
2. Technologies Used
3. Authentication and Authorization
   - User and Speaker Signup
   - OTP Verification
   - Login Authentication
   - Authorization - Role-Based Access Control (RBAC)
   - Protected Routes
4. Session Booking Process
   - Booking a Slot
   - One-Time Slot Booking Rule
   - Multiple Users per Slot
   - Slot Blocking for Double Booking
5. Email Notifications
   - Email Notification upon Booking
   - Email Configuration
   - Customization
6. Google Calendar Integration
   - Google Calendar Invite upon Booking
   - Google Calendar API
   - OAuth for Google Calendar Integration
   - Calendar Invite Details
7. API Documentation
   - Authentication and Authorization
     - User Signup
     - OTP Verification
     - User Login
   - Speaker Profile
     - Speaker Profile Setup
   - Session Booking
     - Get All Speakers
     - Get Available Time Slots for a Speaker
     - Slot Booking
8. Contact


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
- Here is the screenshot of the OTP received by the user:
  ![Screenshot](https://github.com/Ujjawal-Kantt/BookMySesssion/blob/main/images/Screenshot%202024-12-08%20190016.png)


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
- Here is the screenshots of the confirmation email received by the speaker.
![Alt text](https://github.com/Ujjawal-Kantt/BookMySesssion/blob/main/images/Screenshot%202024-12-08%20185929.png)


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
  - Here is the screenshot of Google Calendar Invite mail received by the speaker:
    ![Screenshot](https://github.com/Ujjawal-Kantt/BookMySesssion/blob/main/images/Screenshot%202024-12-08%20185952.png)



--- 
# API Documentation
## A. Authentication and Authorization
## 1. User Signup
**Endpoint:** `POST /signup`  
**Description:**  
This endpoint allows a user (either a general user or a speaker) to sign up by providing their basic information (first name, last name, email, password, and role). An OTP (One-Time Password) is sent to the provided email for verification.

### Request Body:
```json
{
  "firstName": "James",
  "lastName": "Alberto",
  "email": "alberto@gmail.com",
  "password": "strongpasswordhai@!@",
  "role": "speaker"  // 'user' or 'speaker'
}
```
### Response:
- **Status 200:** Success message and the user ID.
```json
{
  "message": "OTP has been sent to your email. Please check your inbox, and if you do not see it, check your spam folder for the verification email.",
  "userId": "53"
}
```
- **Status 400:** If the email is already registered.
```json
{
  "error": "Email is already registered."
}
```
- **Status 500:** If there is an error during signup.
```json
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
{
  "userId": "53",  // ID of the user who is verifying their email
  "otp": "902157"       // OTP sent to the user's email
}
```
### Response:
- **Status 200:** Success message after successful OTP verification.
```json
{
  "message": "Account verified successfully."
}
```
- **Status 400:** If the OTP is invalid or expired.
```json
{
  "error": "Invalid OTP." // or "OTP has expired."
}
```
- **Status 404:** If the user is not found.
```json
{
  "error": "User not found."
}
```
- **Status 500:** If there is an error during OTP verification.
```json
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
{
  "email": "starqw475@gmail.com",
  "password": "justforcheckingpurpose@2121"
}
```
### Response:
- **Status 200:** Success message with the JWT token.
```json
{
  "message": "Login successful.",
  "jwtToken": "eyJhbGciOsInR5cCI6J1c2VySWQiOjUyLCJlbWFpbCI6Z21haWwuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3MzM2NTUzODMsImV4cCI6MTczMzY1ODk4M30.mqkbxSajVJPgTaMD2_dHH1qFVg"  // JWT token
}
```
- **Status 400:** If the email or password is incorrect, or the account is not verified.
```json
{
  "error": "Invalid email or password." // or "Account not verified. Please verify your account first."
}
```
- **Status 500:** If there is an error during login.
```json
{
  "error": "Login failed. Please try again later."
}
```
### Notes:
  - The JWT token is used for authenticating subsequent requests to protected routes.
  - The user must be verified before they can log in.
  - The email OTP expires after 10 minutes, after which the user must request a new JWT Token through login.

## B. Speaker-Profile
## 1. Speaker Profile Setup
**Endpoint:** `POST /setup-profile`  
**Description:**  
This endpoint allows a speaker to set up or update their profile, including their expertise and price per session. It also creates default time slots for the speaker from 9 AM to 4 PM in IST.It also takes the JWT token through the header which is used to check the role of the user.

### Request Body:
```json
{
  "expertise": "Designing and Communications",  // Speaker's area of expertise (e.g., Web Development, Machine Learning)
  "pricePerSession": "5000"  // Price per session in currency units
}
```
### Response:
- **Status 200:** Profile created/updated successfully, along with time slots.
```json

{
  "message": "Profile created/updated and time slots added successfully.",
  "profile": {
    "id": "53",           // Speaker profile ID
    "speaker_id": "56",   // Speaker ID
    "expertise": "Designing and Communcations",     // Speaker's area of expertise
    "price_per_session": "5000" // Speaker's price per session
  }
}
```
- **Status 400:** Missing required fields (expertise or pricePerSession).
```json
{
  "error": "Expertise and price per session are required."
}
```
- **Status 500:** Internal server error during profile setup.
```json
{
  "error": "Failed to set up profile."
}
```
### Notes:
- The profile is either created or updated for the speaker.
- Default time slots from 9 AM to 4 PM (IST) are automatically added after the profile is set up.
- The speaker must have the speaker role to access this endpoint which is being verified by the token sent through the header.

## C. Session-Booking
## 1. Get All Speakers

**Endpoint** `GET /get-speakers`

**Description:** 
This endpoint returns a list of all speakers, optionally filtered by expertise and price range.

### Query Parameters
- `expertise` (optional): A string to filter speakers by their expertise.
- `min_price` (optional): The minimum price per session to filter speakers.
- `max_price` (optional): The maximum price per session to filter speakers.

**Example Request:** ` GET /get-speakers?expertise=AI&min_price=100&max_price=500 `

### Response
- **200 OK**: Returns a list of speakers that match the filter criteria.
  - `speakers`: An array of speaker objects with the following properties:
    - `user_id`: Unique identifier for the user (speaker).
    - `speaker_id`: Unique identifier for the speaker profile.
    - `first_name`: First name of the speaker.
    - `last_name`: Last name of the speaker.
    - `email`: Email address of the speaker.
    - `expertise`: The expertise of the speaker.
    - `price_per_session`: The price the speaker charges per session.

- **404 Not Found**: If no speakers are found that match the filter criteria.
  - `message`: "No speakers found."

- **500 Internal Server Error**: If an error occurs during the query execution.
  - `message`: "Internal server error."

### Example Response
```json
{
  "speakers": [
    {
      "user_id": 1,
      "speaker_id": 101,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "expertise": "AI",
      "price_per_session": 200
    },
    {
      "user_id": 2,
      "speaker_id": 102,
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane.smith@example.com",
      "expertise": "Machine Learning",
      "price_per_session": 300
    }
  ]
}
```
## 2. Get Available Time Slots for a Speaker
**Endpoint:** `GET /:speakerId/slots`
**Description:**
This endpoint returns the available time slots for a specific speaker. It also includes the booking count for each slot.

**URL Parameters:**
  -`speakerId:` The unique identifier for the speaker whose slots are being requested.
### Example Request: 
`GET /1/slots`
**Response:**
    - `200 OK:` Returns an array of time slots available for the speaker with the booking count.
    - `id`: Unique identifier for the time slot.
    - `slot_start:` The start time of the slot, converted to IST.
    - `slot_end:` The end time of the slot, converted to IST.
    - `booking_count:` The number of bookings made for the slot.
    - `204 No Content:` If no slots are available for the requested speaker.
    - `message:` "No slots found for this speaker."
    - `500 Internal Server Error:` If an error occurs while fetching the slots.
    - `error:` "An error occurred while fetching slots."
**Example Response:**
```json
[
  {
    "id": 1,
    "slot_start": "2024-12-08 10:00:00",
    "slot_end": "2024-12-08 11:00:00",
    "booking_count": 2
  },
  {
    "id": 2,
    "slot_start": "2024-12-08 11:30:00",
    "slot_end": "2024-12-08 12:30:00",
    "booking_count": 0
  }
]
```
### Notes;
Time Zone Conversion: The slot_start and slot_end times are provided in UTC and are converted to IST (Indian Standard Time) before being returned.

## D. Slot Booking
# Slot Booking API Documentation

**Endpoint:** `POST /:speakerId/book-slot`
**Description:**
This endpoint allows a user to book a slot with a speaker. It sends email notifications to both the user and the speaker upon a successful booking and also sends calendar invites to both parties.

## Request Parameters

### URL Parameters
- `speakerId`: The ID of the speaker whose slot the user wants to book.

### Request Body
The request body should be a JSON object containing the following parameters:

- `slot_id` (required): The ID of the time slot that the user wishes to book.

Example:

```json
{
  "slot_id": 123
}
```
### Request Headers
**Authorization:** A valid JWT token for user authentication.
**Example:**
- ***Authorization:*** Bearer <user_jwt_token>
**Success Response:**
- `Code:` 200 OK
This response is sent when the slot is successfully booked. It contains details about the booking.

**Example:**
```json

{
  "message": "Slot booked successfully!",
  "booking": {
    "id": 1,
    "user_id": 5,
    "slot_id": 123,
    "speaker_profile_id": 456,
    "created_at": "2024-12-08T10:30:00Z"
  }
}
```
**Error Responses:**
- `Code:` 400 Bad Request
This response is sent if any of the following issues occur:
  - Missing slot_id in the request body.
  - The slot does not exist or does not belong to the specified speaker.
  - The user or speaker email cannot be found.
**Example:**
```json
{
  "message": "Slot ID is required."
}
```
**Code:** 401 Unauthorized
This response is sent if the user is not authenticated or the token is invalid.

**Example:**
```json
{
  "message": "Invalid user authentication."
}
```
**Code:** 404 Not Found
This response is sent if either of the following occurs:
  - The speaker does not exist or has not listed their profile.
  - The slot does not exist or does not belong to the specified speaker.
**Example:**
```json
{
  "message": "Slot not found or does not belong to this speaker."
}
```
**Code:** 400 Bad Request (Booking Conflict)
This response is sent if the user has already booked the slot.

**Example:**
```json
{
  "message": "You have already booked this slot. Multiple bookings are not allowed."
}
```
**Code:** 400 Bad Request (Foreign Key Violation)
This response is sent if an invalid slot_id or speakerId is provided.

**Example:**
```json
{
  "message": "Invalid slot or speaker ID provided."
}
```
**Code:** 500 Internal Server Error
This response is sent in case of any unexpected errors during the booking process.

**Example:**
```json
{
  "message": "Failed to book slot",
  "error": "Internal server error details"
}
```

**Workflow:**
  - ***Authentication:*** The user must provide a valid JWT token in the Authorization header to authenticate the request.
  - ***Slot Validation:*** The system checks if the specified speaker and slot exist. If not, an appropriate error response is sent.
  - ***Booking Insertion:*** If the validation passes, a new booking entry is created in the database.
  - ***Email Notifications:*** After booking, email notifications are sent to both the user and the speaker.
  - ***Calendar Invite:*** A calendar invite with the booking details (start and end times of the slot) is sent to both the user and the speaker.
  - ***Email Notifications:*** Two emails are sent upon a successful booking:
  - ***User Confirmation:*** Sent to the user confirming the slot booking.
  - ***Speaker Notification:*** Sent to the speaker notifying them of the new booking.
      Both emails contain the calendar invite with the booking details.

**Example Flow**
  - The user makes a POST request to /speaker123/book-slot with a slot_id of 456.
  - The system validates the user's authentication and the slot.
  - A new booking entry is created in the database.
  - The user receives a confirmation email.
  - The speaker is notified via email about the new booking.
  - Calendar invites are sent to both the user and the speaker.

## Notes:
  - Ensure that the EMAIL, EMAIL_PASSWORD, and GOOGLE_REFRESH_TOKEN environment variables are set for sending email notifications.
  - The sendCalendarInvite function should handle the calendar invite generation and sending to both user and speaker.
### Contact:
For any queries or issues, reach out at:
  - Email: ujjawalkantt@example.com
  - GitHub: Ujjawal Kantt
