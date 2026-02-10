import express, { Request, Response } from "express";
import cors from "cors";
import { Client, connect, ResultIterator } from "ts-postgres";
import bcrypt from "bcrypt";
import { Group, Account, Message, Profile, ServerSettings } from "./types/types";
import winston, { Logger } from "winston";
import "express-session";
import { channel } from "diagnostics_channel";
const session = require("express-session");
const app = express();
app.use(express.json());
app.set("trust proxy", 1);
app.use(
  cors({
    origin: "http://127.0.0.1:5500",
    credentials: true,
  }),
);
app.use(
  session({
    name: "session",
    store: new (require("connect-pg-simple")(session))({
      conString: "postgres://postgres:postgres@127.0.0.1:5432/mediapp",
      createTableIfMissing: true,
    }),
    secret: "anyrandomtext",
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: false,
    },
  }),
);

const logger: Logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "user-service" },
  transports: [new winston.transports.Console()],
});
const PORT: number = 3000;
let client: Client;

async function setupClient() {
  try {
    client = await connect({ user: "postgres", password: "postgres", database: "mediapp" });
  } catch {
    logger.error("Could not connect to SQL Database @ chatmanager:30");
  }
}
setupClient();

async function addNewAccountToDatabase(newAccount: Account) {
  const res = await client.query<Account>(`INSERT INTO users (displayname, username, password) VALUES ("${newAccount.displayname}", "${newAccount.username}", "${newAccount.userid}")`);
}

async function getUserFromID(id: number): Promise<Account | null> {
  try {
    const query = await client.query<Account>("SELECT * FROM public.users WHERE userid=" + id + ";");
    return [...query][0];
  } catch (e) {
    console.error(e);
    return null;
  }
}

async function findAccountInDatabase(username: string): Promise<Account | void> {
  if (!username) {
    logger.error("Username not provided");
    return undefined;
  }
  const res = await client.query<Account>(`SELECT ${username} FROM public.users`);
  return [...res][0];
}

app.post("/signup", async (req: Request, res: Response): Promise<any> => {
  const { username, password } = req.body;
  if (username == null || password == null) {
    res.status(400).send("Please add all arguments");
  }
  let account: Account = {
    username,
    password,
    userid: 2,
    displayname: username,
  };
  await addNewAccountToDatabase(account);
  return res.status(200).send(account);
});

app.post("/login", async (req: Request, res: Response): Promise<any> => {
  let { usr, psw } = req.body;
  const result = await client.query<Account>("SELECT * FROM public.users WHERE username = $1 AND password = $2", [usr, psw]);
  const acc: Account = [...result][0];
  if (acc === undefined) {
    return res.status(400).send("Incorrect Username/Password");
  }
  if (psw === acc.password) {
    console.log(usr + " logged in at " + new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString());
    req.session.user = { id: acc.userid.toString() };
    req.session.save();
    return res.status(200).send({ displayname: acc.displayname });
  }
  return res.status(401).send("Incorrect Username/Password");
});

app.post("/addFreind", async (req: Request, res: Response): Promise<any> => {
  let { usr, friendName } = req.body;
  if (usr == null || friendName == null) {
    return res.status(400).send("Please add all arguments");
  }
  const query = client.query<Account>(`SELECT * FROM public.users WHERE displayname = ` + friendName);
  const freind: Account = query.first();
  if (freind === undefined) {
    return res.status(404).send("Could not find account");
  }
  return res.status(200).send(freind);
});

async function getServerIDNames(req: Request) {
  let userid: string = req.session.user.id;
  const serverId = [...(await client.query(`SELECT serverid FROM public.serversjoineduser WHERE userid=${userid}`))];
  const serverName = [...(await client.query(`SELECT servername FROM public.servers WHERE serverid=1`))];
  let servers = [];
  for (let i = 0; i < serverId.length; i++) {
    servers[i] = { serverid: serverId[i]["serverid"].toString(), serverName: serverName[i]["servername"] };
  }
  let serverIdsAndNames = { servers: servers };
  return JSON.stringify(serverIdsAndNames);
}
app.get("/getServerIDNames", async (req: Request, res: Response) => {
  res.send(await getServerIDNames(req));
});

app.post("/createChannel", async (req: Request, res: Response): Promise<any> => {
  let cName = req.body.channelName;
  let cDes = req.body.channelDes;
  let cOwner = req.body.channelOwner;
  if (cName == null || cDes == null || cOwner == null) {
    return res.status(400).send("Please add all arguments");
  }
  await client.query("INSERT INTO channels (channelName, channelDes, ChannelOwner) VALUES ($1, $2, $3)", [cName, cDes, cOwner]);
  return res.status(200).send("Channel created");
});

function formatMessage(sender: string, message: string, timesent: number): Message {
  return { senderid, message, timesent };
}

app.post("/getChannelIDNames", async (req: Request, res: Response): Promise<any> => {
  // The reason it is failing is becasue serverid below is undefined. Checked by console.logging.
  let serverid: string = req.body.serverid;
  let channels = [...(await client.query("SELECT channelid, channelname FROM channels WHERE serverid=" + serverid))];
  console.log("Channels" + channels);
  // for (let i = 0; i < channels.length; i++) {
  //   channels[i]['channelid'] = channels[i].['channelid'].toString(); //Error converting BigInt to String
  // }
  let channelIdsAndNames = { channels: channels };
  res.status(200).send(channelIdsAndNames);
  return JSON.stringify(channelIdsAndNames);
});

app.post("/sendmsg", async (req: Request, res: Response): Promise<any> => {
  const { message, isGroup } = req.body;
  const sender = req.session.user.id;
  const account: Account | null = await getUserFromID(sender);
  if (sender === undefined || message === undefined || account === undefined) {
    logger.error("All args not provided chatmanager:169");
    return res.status(400).send("All args not provided");
  }
  if (account == null) {
    return res.status(400).send("Account = null");
  }
  const username: string = account.username;
  if (!username) {
    logger.error("Could not find the required args (username)/chatmanager:160");
    return res.status(404).send("Could not find database");
  }
  const fullMessage: Message = formatMessage(account.displayname, message, Date.now());
  console.log(`${fullMessage.displayname}: ${fullMessage.messagecontent} @ ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`);
  if (isGroup) {
    return res.status(200).send("Group message received");
  }
  let SQLMessage: Message = {
    senderid: sender,
    displayname: sender,
    messagecontent: fullMessage.messagecontent,
    timesent: fullMessage.timesent,
  };
  const result = client.query(`INSERT INTO messages (senderid, messagecontent, channelid, timesent) VALUES (${SQLMessage.senderid}, '${SQLMessage.messagecontent}', 1, '${SQLMessage.timesent}')`);
  return res.status(200);
});

async function updateSettings(serverSettings: ServerSettings, servername: string) {}
app.post("/updateSettings", async (req: Request, res: Response) => {
  const servername: string = req.body.servername;
  const serverSettings: ServerSettings = {
    serverName: req.body.serverName,
    serverDes: req.body.serverDes,
    isVisible: req.body.isVisible,
    canMessage: req.body.canMessage,
  };
  await updateSettings(serverSettings, servername);
  res.status(200).send("Settings updated");
});

function findServerInDatabase(id: number) {
  const query = client.query("SELECT * FROM public.servers WHERE serverid=" + id);
  const server = query.first();
  if (server == undefined) {
    return null;
  }
  return server;
}

async function getServerMemberUsernames(serverID: number): Promise<string | null> {
  const members = client.query<Account>("SELECT * FROM public.users WHERE serverID = ", [serverID]);
  if (!members) {
    logger.error("Members not found for the given server ID");
    return null;
  }
  return members.toString();
}

async function getServerData(serverID: number): Promise<string | null> {
  if (!serverID) {
    logger.error("Must provide serverID");
    return null;
  }
  let data = await getServerMemberUsernames(serverID);
  if (data == null) {
    throw new Error("Could not find server data");
  }
  return data;
}

app.post("/createServer", async (req: Request, res: Response): Promise<any> => {
  let chatName,
    chatDes,
    chatOwner = req.query;
  if (!chatName || !chatDes || !chatOwner) {
    return res.status(400).send("Chat name or chat description not provided.");
  }
  try {
    await client.query<Group>(`INSERT INTO servers ("servername", "serverdes", "serverowner") VALUES (${chatName}, ${chatDes}, ${chatOwner})`);
  } catch (error) {
    logger.error(error);
    return res.status(500).send("Internal server error");
  }
});

app.get("/getChatID", async (req: Request, res: Response): Promise<any> => {
  return res.status(200).send(getServerIDNames(req));
});

app.get(`/getChannelMessageServer`, async (req: Request, res: Response): Promise<any> => {
  const serverid = req.query["serverid"];
  let server = await client.query("SELECT * FROM public.messages WHERE senderid=" + serverid);
  if (!server) {
    return res.status(401).send("Server not defined in arguments chatmanager:341");
  }
});

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

app.get("/getChatMessages", async (req: Request, res: any) => {
  let serverID = req.query["serverID"];
  if (serverID == undefined) {
    return res.status(400).send("Must provide server ID: chatManager:364");
  }
  try {
    let request: Message[] = [...(await client.query<Message>("SELECT senderid, messagecontent, timesent FROM messages WHERE channelid=" + serverID))];
    request.forEach((element) => {
      element.senderid = element.senderid.toString();
      element.messagecontent = element.messagecontent.toString();
      element.timesent = element.timesent;
    });
    return res.status(200).send(request);
  } catch (error) {
    return res.status(200).send("No new messages");
  }
});

async function startServer() {
  try {
    app.listen(PORT, () => {
      logger.log("info", `Mediapp listening on port ${PORT}.`);
    });
    process.on("SIGTERM", async () => {
      logger.log("info", "Server Shutting Down without Error");
      await client.end();
    });
  } catch (error) {
    logger.error("Server failed:", error);
    process.exit(1);
  }
}
startServer();
