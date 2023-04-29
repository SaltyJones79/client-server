import * as net from 'net';
import * as fs from 'fs';
import { join } from 'path';
import {Semaphore, withTimeout } from 'async-mutex';



const writeSemaphore = new Semaphore(1);
const usersFile = join(__dirname, 'users.json');

interface UserData {
    username: string;
    password: string;
    newUser: boolean;
}

interface User {
    id: number;
    username: string;
    password: string;
    boardGames: BoardGame[];
}

interface BoardGame {
    id: number;
    name: string;
    timesPlayed: number;
    lastPlayed: string;
    rating: number;
    wins: number;
    category: string;
}

//Creates a server that listens for incoming client connections
const server = net.createServer((socket) => {
    console.log('Client connected ' + socket.address);
    socket.write('Welcome to Boardgame Collector!\n');

    //Listen for incoming data from the client
    socket.on('data', (data) => {
        const receivedData = data.toString();
        console.log('Received data from server const in socket.on: ' + receivedData);
        // check if the received data is a valid JSON
        try {
            console.log('Received data from try in socket.on: ' + receivedData);
            const parsedData = JSON.parse(receivedData) as UserData;
            console.log('Parsed data from try in socken.on: ' + parsedData.username + parsedData.password + parsedData.newUser);
            handleUserAuth(parsedData, socket);
        } catch (err) {
            console.error('Invalid JSON received:', err);
            //send error message to the client
            socket.write('Error: Invalid JSON received');
        }
    });

    socket.on('end', () => {
        console.log('Client disconnected');
    });
});

// User authentication and creation logic
async function handleUserAuth(receivedData: UserData, socket: net.Socket) {
    console.log('Received data from handleUserAuth: ' + receivedData.username  + receivedData.password + receivedData.newUser);
  try {
    const [_,releaser] = await withTimeout(writeSemaphore, 1000, new Error('Timeout acquiring lock')).acquire();
    
    try {
      const fileData = await fs.promises.readFile(usersFile, 'utf8');
      const users = JSON.parse(fileData);
      const existingUser = Array.isArray(users) ? users.find((user: UserData) => user.username.toLowerCase() === receivedData.username.toLowerCase()) : undefined;

      console.log('Received data from first try in handleUserAuth: ' + receivedData);

      if (!existingUser && receivedData.newUser) {
        const newUser: User = {
            id: users.length + 1,
            username: receivedData.username,
            password: receivedData.password,
            boardGames: []
        };
        users.push(newUser);
        try {
          await fs.promises.writeFile(usersFile, JSON.stringify(users));
          socket.write('User created successfully\n');
        } catch (err) {
          console.log('Error writing users file:', err);
        }
      } else if (existingUser && !receivedData.newUser) {
        if (existingUser.password === receivedData.password) {
          socket.write('Password matched\n');
          const currentUser: User = existingUser as User;
          socket.write('Enter a menu option number:');
          socket.on('data', (data) => {
            const receivedOption = data.toString().trim();
            handleMenuOptions(receivedOption, socket, currentUser);
          });
        } else {
          socket.write('Incorrect password\n');
        }
      } else if (existingUser && receivedData.newUser) {
        socket.write('Username already exists\n');
      } else {
        socket.write('User not found\n');
      }
    } catch (err) {
      console.error('Error reading users file:', err);
    } finally {
      releaser(); // Release the write lock
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'Timeout acquiring lock') {
      console.error('Failed to acquire lock:', err);
    } else {
      console.error('Unknown error:', err);
    }
  }
}

function handleMenuOptions(receivedData: string, socket: net.Socket, currentUser: User) {
    console.log('Received data from handleMenuOptions: ' + receivedData);
    switch (receivedData) {
        case '1': //View my collection
            console.log('case 1 called and received data: ' + receivedData);
            if (currentUser.boardGames.length === 0) {
                socket.write('Your collection is empty.\n');
            } else {
                socket.write('Game\tCategory\tPlay Count\tLast Played\tWins\n');
                currentUser.boardGames.forEach((game: BoardGame) => {
                    socket.write(`${game.name}\t${game.category}\t${game.timesPlayed}\t${game.lastPlayed}\t${game.wins}\n`);
                });
            }
            socket.write('Operation completed\n');
            break;
        case '2'://Add game
            console.log('case 2 called and received data: ' + receivedData);
            addBoardGame(socket, currentUser);
            socket.write('Operation completed\n');
            break;
        case '3'://remove game
            console.log('case 3 called and received data: ' + receivedData);
            socket.write('Enter the ID of the game you want to remove:\n');
            socket.once('data', (data) => {
                const gameId = parseInt(data.toString().trim());
                const gameIndex = currentUser.boardGames.findIndex((game) => game.id === gameId);

                if (gameIndex > -1) {
                    currentUser.boardGames.splice(gameIndex, 1);
                    socket.write(`Game with ID ${gameId} removed from your collection.\n`);
                    socket.write('Operation completed\n');
                } else {
                    socket.write(`Game with ID ${gameId} not found in your collection.\n`);
                }
            });
            socket.write('Operation completed\n');
            break;
        case '4'://View other users' collections
            console.log('case 4 called and received data: ' + receivedData);
            const allUsers = getAllUsers();
            allUsers.forEach((user: User) => {
                if(user.username !== currentUser.username) {
                    socket.write(`\nUser: ${user.username}\n`);
                    user.boardGames.forEach((game: BoardGame) => {
                        socket.write(`Name: ${game.name}, Category: ${game.category}\n`);
                    });
                }
            })
            socket.write('Operation completed\n');
            break;
        case '5'://Update game info
            console.log('case 5 called and received data: ' + receivedData);
            handleUpdateGameInfo(socket, currentUser);
            socket.write('Operation completed\n');
            break;
        case '6'://close connection
            console.log('case 6 called and received data: ' + receivedData);
            socket.end();
            break;
        default:
            socket.write('Please enter a valid option');
            break;
    }
}

function handleUpdateGameInfo(socket: net.Socket, currentUser: User) {
    socket.write('Enter the ID of the game you want to update:\n');
    socket.once('data', (data) => {
        const gameId = parseInt(data.toString().trim());
        const game = currentUser.boardGames.find((game) => game.id === gameId);

        if(game) {
            socket.write(`Current game name: ${game.name}, ${game.category}\n`);
            socket.write('Enter the new game name and category in the following format:\n');
            socket.write('newName,newCategory\n');
            socket.once('data', (data) => {
                const newData = data.toString().trim().split(',');
                const newName = newData[0];
                const newCategory = newData[1];

                if(newName && newCategory) {
                    game.name = newName;
                    game.category = newCategory;
                    socket.write(`Game updated: Name: ${game.name}, Category: ${game.category}\n`);
                    socket.write('Operation completed\n');
                } else {
                    socket.write('Error: Game name or category is missing\n');
                }
            });
        }else {
            socket.write(`Game with ID ${gameId} not found in your collection.\n`);
        }
    });
}

function readData(socket: net.Socket): Promise<string> {
    return new Promise((resolve) => {
      socket.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });
  }
  
async function addBoardGame(socket: net.Socket, currentUser: User) {
    socket.write('Enter the game name:\n');
    const gameName = await readData(socket);
  
    socket.write('Enter the game category:\n');
    const gameCategory = await readData(socket);
  
    // Add other board game information here
  
    if (gameName && gameCategory) {
      const newGame: BoardGame = {
        id: currentUser.boardGames.length + 1,
        name: gameName,
        timesPlayed: 0,
        lastPlayed: '',
        rating: 0,
        wins: 0,
        category: gameCategory,
      };
      currentUser.boardGames.push(newGame);
      socket.write(`Game added: ${gameName}\n`);
      socket.write('Operation completed\n');
    } else {
      socket.write('Error: Game name or category is missing\n');
    }
  }
  
function getAllUsers(): User[] {
    const usersData = fs.readFileSync(usersFile, 'utf8');
    return JSON.parse(usersData);
  }

const PORT = 8000;
server.listen(PORT, () => {
    console.log('Server listening on port ' + PORT);
});