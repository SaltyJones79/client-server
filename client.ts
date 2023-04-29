import * as net from 'net';
import * as readline from 'readline';

const client = new net.Socket();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,  
});

client.connect(8000, 'localhost', () => {
    console.log('Connected to server');
});

let isInputExpected = false;

client.on('data', (_data) => {
  const serverMessage = _data.toString();
  console.log(serverMessage);

  if (serverMessage.startsWith('Welcome')) {
    askUserType();
  } else if (serverMessage.startsWith('Username already exists')) {
    createNewUser();
  } else if (serverMessage.startsWith('User created successfully') || serverMessage.startsWith('Password matched')) {
    mainMenu();
  } else if (serverMessage.startsWith('Please enter a valid option') || serverMessage.startsWith('User not found')) {
    mainMenu();
  } else if (serverMessage.startsWith('Enter game details') || serverMessage.startsWith('Enter the new game name')) {
    isInputExpected = true;
    handleGameInput();
  } else if (serverMessage.startsWith('Operation completed')) {
    isInputExpected = false;
    if (!isInputExpected) {
      mainMenu();
    }
  }
});


function askUserType() {
  rl.question('Are you a new user? (yes/no): ' , (answer) => {
    if (answer.toLowerCase() === 'yes') {
      createNewUser();
    } else if (answer.toLowerCase() === 'no') {
      loginUser();
    } else {
      console.log('Invalid input. Please enter "yes" or "no".');
      askUserType();
    }
  });
}

function createNewUser() {
    rl.question('Enter a username: ', (username) => {
      rl.question('Enter a password: ', (password) => {
        const userData: { username: string; password: string; newUser: boolean } = {
          username,
          password,
          newUser: true,
        };
        console.log('User data from createNewUser: ' + JSON.stringify(userData));
        client.write(JSON.stringify(userData));
      });
    });
  }

  function loginUser() {
    rl.question('Enter your username: ', (username) => {
      rl.question('Enter your password: ', (password) => {
        const userData: { username: string; password: string; newUser: boolean } = {
          username,
          password,
          newUser: false,
        };
        console.log('User data from loginUser: ' + JSON.stringify(userData));
        client.write(JSON.stringify(userData));
      });
    });
  }

  function mainMenu() {
    console.log(
      'Options:\n',
      '1. View my collection\n',
      '2. Add game\n',
      '3. Remove game\n',
      '4. View other users collection\n',
      '5. Update game info\n',
      '6. Close connection\n'
    );
  
    rl.question('\nChoose an option (1-6): ', (choice) => {
      const validOptions = ['1', '2', '3', '4', '5', '6'];
      if (validOptions.includes(choice)){
        client.write(choice);
      } else {
        console.log('Invalid option. Please choose a number between 1 and 6.');
        mainMenu();
      }
    });
  }
  

  function handleGameInput() {
    rl.question('Enter the details as instructed: ', (input) => {
      client.write(input);
    });
  }

client.on('close', () => {
    console.log('Connection closed');
});