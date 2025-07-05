import express, { Request, Response } from "express";
import cors from "cors";
import fs from "fs";
import { Client, connect, Result, ResultIterator } from "ts-postgres";
import bcrypt from "bcrypt";
import { Group, Account, Message, Database, Profile } from "./types/types";
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
const PORT: number = 3000;
let activeChats: string[] = [];
let SERVERDATABASE: Database;
let USERSDATABASE: Database;
let client: Client;

(async () => {
  const userData = await readDatabase("database/users.json");
  const serverData = await readDatabase("database/servers.json");
  if (!userData || !serverData) {
    throw new Error("Failed to load user database");
  }
  USERSDATABASE = userData;
  SERVERDATABASE = serverData;
  try {
    client = await connect({
      user: "postgres",
      password: "postgres",
      database: "mediapp",
    });
  } catch {
    console.error("Could not connect to SQL Database @ chatmanager:38");
  }
})();

async function readDatabase(name: string): Promise<Database | null> {
  try {
    const d = await fs.promises.readFile(name, "utf8");
    return JSON.parse(d);
  } catch (e) {
    console.error(e);
    return null;
  }
}

async function writeDatabase(data: object, name: string) {
  if (!data) return console.log("No Data found");
  try {
    const e: any = await readDatabase(name);
    await fs.promises.writeFile(`${name}_bak.json`, JSON.stringify(e));
    await fs.promises.writeFile(name, JSON.stringify(data));
  } catch {
    return console.error("Failed to write to database @ chatmanager:39");
  }
}

function binarySearch<Sortable>(
  arr: Sortable[],
  low: number,
  high: number,
  toFind: Sortable
) {
  if (high >= low) {
    let mid = low + Math.floor((high - low) / 2);
    if (arr[mid] == toFind) return mid;
    if (arr[mid] > toFind) return binarySearch(arr, low, mid - 1, toFind);
    return binarySearch(arr, mid + 1, high, toFind);
  }
  return null;
}

async function findUsernameByDisplayName(
  displayName: string
): Promise<string | null> {
  if (!USERSDATABASE) {
    console.error("Could not read database");
    return null;
  }
  for (const username in USERSDATABASE.accounts) {
    if (USERSDATABASE.accounts[username].displayName === displayName) {
      return username;
    }
  }
  return null;
}

async function findAccountInDatabase(
  databaseName: string,
  username: string
): Promise<Account | void> {
  if (!databaseName || !username) {
    console.error("Args not provided");
    return undefined;
  }
  const database: Database | null = await readDatabase(databaseName);
  if (database === null) {
    return console.error("Could not find account");
  }
  return database.accounts[username];
}

app.post("/signup", async (req: Request, res: Response): Promise<any> => {
  const { username, password } = req.body;
  if (username == null || password == null) {
    res.status(400).send("Please add all arguments");
  }
  let account: Account = {
    username,
    password,
    userID: 2,
  };
  await addNewAccountToDatabase("database/users.json", account);
  return res.status(200).send(account);
});

app.post("/login", async (req: Request, res: Response): Promise<any> => {
  let { usr, psw } = req.body;
  const result: ResultIterator<Account> = client.query<Account>(
    `SELECT * FROM users WHERE username='${usr}' AND password='${psw}'`
  );
  const acc = await result.one();
  console.log(acc);
  if (acc === undefined) {
    return res.status(400).send("Could not find account");
  }
  if (psw === acc.password) {
    console.log(
      usr +
        " logged in at " +
        new Date().toLocaleDateString() +
        " " +
        new Date().toLocaleTimeString()
    );
    return res.status(200).send({ displayname: acc.displayName });
  } else {
    return res.status(401).send("Incorrect Username/Password");
  }
});

app.post("/addFreind", async (req: Request, res: Response): Promise<any> => {
  let { usr, friendName } = req.body;
  if (usr == null || friendName == null) {
    return res.status(400).send("Please add all arguments");
  }
  const account: Account | void = USERSDATABASE.accounts[usr];
  if (account === undefined) {
    return res.status(404).send("Could not find account");
  }
  return res.status(200).send(account);
});

app.post(
  "/createChannel",
  async (req: Request, res: Response): Promise<any> => {
    let cName = req.body.channelName;
    let cDes = req.body.channelDes;
    let cOwner = req.body.channelOwner;
    if (cName == null || cDes == null || cOwner == null) {
      return res.status(400).send("Please add all arguments");
    }
    const account: Account | void = USERSDATABASE.accounts[cOwner];
    if (account === undefined) {
      return res.status(404).send("Could not find account");
    }
  }
);

function formatMessage(
  sender: string,
  message: string,
  timesent: number
): Message {
  return {
    sender,
    message,
    timesent,
  };
}

function getOwnerOfGroup(groupName: string): Profile | null {
  const owner: Profile = {
    username: "",
    displayName: "",
    userID: 0,
  };
  if (owner == undefined) {
    return null;
  }
  return owner;
}

app.post("/sendmsg", async (req: Request, res: Response): Promise<any> => {
  const { sender, message, isGroup } = req.body;
  if (!sender || !message) {
    console.error("All args not provided");
    return res.status(400).send("All args not provided");
  }
  const username = await findUsernameByDisplayName(sender);
  if (username == undefined) {
    console.error("Could not find the required args/chatmanager:136");
    return res.status(404).send("Could not find database");
  }
  const acc: Account | void = await findAccountInDatabase(
    "database/users.json",
    username
  );
  if (!acc || typeof acc !== "object" || !acc.displayName) {
    console.error("ERROR: Could not send message @ chatmanager:137");
    return res.status(404).send("Could not find account");
  }
  const fullMessage = formatMessage(acc.displayName, message, Date.now());
  console.log(
    `${fullMessage.sender}: ${
      fullMessage.message
    } @ ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`
  );
  if (isGroup === true) {
    return res.status(200).send("Group message received");
  } else {
    let JSONMsg: Message = {
      sender: fullMessage.sender,
      message: fullMessage.message,
      timesent: fullMessage.timesent,
    };
    writeDatabase(JSONMsg, "database/users.json");
    console.log(JSONMsg);
    return res.status(200).send("Direct message sent");
  }
});

async function updateSettings(
  oldServerName: string,
  serverDes: string,
  isVisible: boolean
) {
  let groupMembers: Profile[] = [];
  let groupToUpdate: Group = {
    groupName: oldServerName,
    groupDescription: serverDes,
    isPublic: isVisible,
    id: 1,
    owner: undefined,
    members: groupMembers,
  };

  return groupToUpdate;
}

app.post("/updateSettings", async (req: Request, res: Response) => {
  let serverName = req.body.serverName;
  let serverDes = req.body.serverDes;
  let isVisible = req.body.isVisible;
  let canMessage = req.body.canMessage;
  await updateSettings(serverName, serverDes, isVisible);
  res.status(200).send("Settings updated");
});

async function usernameToMember(username: string): Promise<Profile | null> {
  let usernameInDatabase = USERSDATABASE.accounts[username];
  if (usernameInDatabase == undefined) {
    return null;
  }
  const member: Profile = {
    username: "Name",
    displayName: "name",
    userID: 1,
  };
  return member;
}

async function createFolder(folderName: string, dir: string) {
  await fs.promises.mkdir(`${dir}/${folderName}`);
}

async function createChat(
  chatName: string,
  chatDes: string,
  chatOwner: Account
): Promise<Group | void> {
  let exists = activeChats.find((name) => name === chatName);
  if (exists) {
    return console.log("Name allready exists");
  } else {
    const newChat: Group = {
      groupName: chatName,
      groupDescription: chatDes,
      members: [],
      owner: chatOwner,
      isPublic: false,
      id: 0,
    };
    return newChat;
  }
}

function findServerInDatabase(id: number) {
  const server: Group = {
    groupName: "",
    groupDescription: "",
    members: [],
    owner: undefined,
    isPublic: false,
    id: id,
  };
  if (server) {
    return server;
  } else {
    return null;
  }
}

async function getServerMemberUsernames(
  serverID: number
): Promise<string | null> {
  const members = USERSDATABASE.servers[serverID]?.members;
  if (!members) {
    console.error("Members not found for the given server ID");
    return null;
  }
  return members.toString();
}

async function getServerData(serverID: number): Promise<string | void> {
  if (!serverID) {
    return console.error("Must provide serverID");
  }
  let data = await getServerMemberUsernames(serverID);
  if (data == null) {
    throw new Error("Could not find server data");
  }
  return data;
}

app.post("/createChat", async (req: Request, res: Response): Promise<any> => {
  try {
    let chatName = req.query["chatName"];
    let chatDescription = req.query["chatDes"];
    let chatOwner = req.query["chatOwner"];
    if (!chatName || !chatDescription || !chatOwner) {
      return res
        .status(400)
        .send("Chat name or chat description not provided.");
    }
    let chat = await createChat(
      chatName as string,
      chatDescription as string,
      chatOwner as unknown as Account
    );
    return res.status(200).send(chat);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
});

app.get("/getChatID", async (req: Request, res: Response): Promise<any> => {
  const chatName = req.body.chatName;
  const chatID = 0; // To Change to actual database chatID
  return res.status(200).send({ chatID: chatID });
});

app.get(
  `/getChannelMessageServer`,
  async (req: Request, res: Response): Promise<any> => {
    const serverID = req.query["serverID"];
    let messages = SERVERDATABASE.messages;
    if (messages) {
      return res.status(200).send(messages);
    }
  }
);

app.get("/server", async (req: Request, res: Response): Promise<any> => {
  const serverID: number | undefined = Number(req.query["serverID"]);
  if (!serverID) {
    return res.status(400).send("Must provide serverID");
  }
  const serverData = await getServerData(serverID);
  return res.status(200).send(serverData);
});

app.post("/test", (_req: Request, res: Response) => {
  res.status(200).send("Server Is Running");
});

async function addNewAccountToDatabase(
  databaseName: string,
  newAccount: Account
) {
  if (databaseName == null) {
    return console.error("Database name not provided");
  }
  const database = await readDatabase(databaseName);
  if (database === null) {
    return console.error("No Existing Data");
  }
  database.accounts[newAccount.username] = newAccount;
  await writeDatabase(database, databaseName);
}

app.get("/getChatMessages", async (req: Request, res: any) => {
  let serverID = req.query["serverID"] as any;
  if (serverID == undefined) {
    return res.status(400).send("Must provide server ID");
  }
  const serverIDStr = Array.isArray(serverID) ? serverID[0] : serverID;
  console.log("SERVERDATABASE: ", SERVERDATABASE.servers);
  if (SERVERDATABASE.messages == undefined) {
    return res.status(404).send("Could not find messages");
  }
  return res.status(200).send(findServerInDatabase(serverID));
});

async function startServer() {
  try {
    const userData = await readDatabase("database/users.json");
    const serverData = await readDatabase("database/servers.json");
    if (!userData || !serverData) {
      throw new Error("Failed to load databases");
    }

    app.listen(PORT, () => {
      console.log(`Mediapp listening on port ${PORT}.`);
    });
    process.on("SIGTERM", async () => {
      console.log("Server Shutting Down without Error");
      await client.end();
    });
  } catch (error) {
    console.error("Server failed:", error);
    process.exit(1);
  }
}
startServer();
