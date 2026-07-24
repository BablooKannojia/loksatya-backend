# Node.js Project

A simple Node.js boilerplate project for testing and development.

## Features

- Express.js server
- Environment variable support
- REST API example
- Error handling
- Logging
- Ready for deployment

## Project Structure

```
dummy-node-app/
│
├── src/
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── utils/
│   └── app.js
│
├── .env
├── .gitignore
├── package.json
├── server.js
└── README.md
```

## Prerequisites

- Node.js >= 18
- npm or yarn

## Installation

Clone the repository:

```bash
git clone https://github.com/your-username/dummy-node-app.git
```

Go to the project directory:

```bash
cd dummy-node-app
```

Install dependencies:

```bash
npm install
```

## Environment Variables

Create a `.env` file in the root directory.

```env
PORT=5000
NODE_ENV=development
```

## Run the Project

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

## API Example

### Health Check

**GET** `/`

Response

```json
{
  "success": true,
  "message": "Server is running!"
}
```

## Available Scripts

| Command | Description |
|---------|-------------|
| npm start | Start the server |
| npm run dev | Start server with Nodemon |
| npm test | Run tests |

## Technologies Used

- Node.js
- Express.js
- dotenv
- nodemon

## License

This project is licensed under the MIT License.

## Author

Your Name

---

Happy Coding! 🚀
