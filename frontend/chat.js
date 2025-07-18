const server = "http://127.0.0.1:3000"; // localhost (do not change)
const loggedInDisplayName = localStorage.getItem("displayName");

if (!loggedInDisplayName) {
  window.location.href = "index.html";
}
let currentChatMessages;
const chatMessagesFromServer = "";
let ServerName = "server";
let messageHistory = [];
let lastAmountOfMessages = getLastMesssagesLength();

function getLastMesssagesLength() {
  const amount = messageHistory.length;
  return amount;
}

function getServer(serverID) {
  let returnedServerID;
  let serverName;
  let serverDes;
  fetch(
    `${server}/server${new URLSearchParams({
      serverID,
    })}`
  )
    .then((res) => {
      if (res.ok) {
        res.json().then((json) => {
          returnedServerID = res.serverID;
          serverName = res.serverName;
          serverDes = res.serverDes;
        });
      }
    })
    .catch((err) => {
      return console.err(err);
    });
  return;
}

function sendMessage(sender, message, isGroup) {
  return new Promise((resolve, reject) => {
    if (sender === undefined || message === undefined) {
      reject("Must provide all arguments");
      return;
    }
    fetch(`${server}/sendmsg`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sender, message, isGroup }),
    })
      .then((res) => {
        if (res.status === 200) {
          resolve(res);
          console.log(res);
        } else {
          reject("Failed to send message");
          console.warn("Failed to send message");
        }
      })
      .catch((err) => {
        reject(err);
        console.error("Error:", err);
      });
  });
}

function createChat(name, des) {
  fetch(`${server}/createchat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
    body: JSON.stringify({
      name,
      des,
    }),
  });
}

function getChatID(name) {
  return fetch(`${server}/getChatID`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  }).then((res) => {
    res.json().then((json) => {
      let chatID = 1;
      return chatID;
    });
  });
}

function getMessageFromServer(serverID) {
  const getMessagePromise = new Promise((resolve, reject) => {
    if (serverID == undefined) {
      reject("Must provide serverID");
      return;
    }

    fetch(
      `${server}/getChatMessages?${new URLSearchParams({
        serverID: serverID,
      })}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Content-Type-Options": "nosniff",
        },
      }
    )
      .then((res) => {
        console.log(
          `${server}/getChatMessages?${new URLSearchParams({
            serverID: serverID,
          })}`
        );
        res
          .json()
          .then((json) => resolve(json))
          .catch((err) => {
            return reject(err);
          });
      })
      .catch((err) => {
        return reject(err);
      });
  });
  return getMessagePromise;
}

function getChannelMessageServer(name) {
  if (name === undefined) {
    return false;
  }
  fetch(`${server}/getChannelMessageServer`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  }).then((res) => {
    res.json().then((json) => (chatMessagesFromServer = json));
  });
}

function getMessagesFromClient() {
  let messages = [{ sender: loggedInDisplayName, message: "Hi" }];
  return messages;
}

function updateSettingsEndpoint(serverName, serverDes, isVisible, canMessage) {
  fetch(`${server}/updateSettings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
    body: JSON.stringify({
      serverName,
      serverDes,
      isVisible,
      canMessage,
    }),
  });
}

function createChannel(chatName, channelName) {
  if (chatName == undefined || channelName == undefined) {
    console.error("All args not fufilled @ chat.js @ 177");
  }
}

function pollMessages(serverID) {
  fetch(
    `${server}/getChatMessages?${new URLSearchParams({
      serverID: serverID,
    })}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Content-Type-Options": "nosniff",
      },
    }
  )
    .then((res) => res.json())
    .then((res) => {
      const server1 = res["SERVER 1"];
      const channel1Messages = server1["Channel 1"].messages;
      if (channel1Messages.length > lastAmountOfMessages) {
        for (const message of channel1Messages) {
          createAndAppend(
            "p",
            messageViewBox,
            message.username + ": " + message.message
          );
        }
        lastAmountOfMessages = channel1Messages.length;
      }
    })
    .catch((err) => {
      if (err && typeof err == String) {
        console.error(err);
        return null;
      }
      return null;
    });
  saveServerData(getChatID(ServerName));
}

const addChannelButton = document.getElementById("channelAdd");
const channelSettingsButton = document.getElementById("channelSettings");
const newChannelDialog = document.getElementById("newChannelDialog");
const newChannelDialogForm = document.getElementById("newChannelDialogForm");
const newChannelCancel = document.getElementById("closeChannelDialog");
const channelSettingsSubmit = document.getElementById("submitSettings");
const channelSettingsClose = document.getElementById("channelSettingsCancel");
const channelSettingsGui = document.getElementById("channelSettingsGUI");
const visibleCheckbox = document.getElementById("visibleCheckbox");
const messageCheckbox = document.getElementById("messageCheckbox");
const channelNameInput = document.getElementById("channelNameBox");
const channelDesInput = document.getElementById("chanelDesBox");
const serverNameHeader = document.getElementById("servername");
const channelNameHeader = document.getElementById("channelHeaderText");
const channel1Header = document.getElementById("channel1");
const channelDesHeader = document.getElementById("channelDesText");
const menuButton = document.getElementById("menuIcon");
const serverSettingsGui = document.getElementById("serverSettingsDialog");

let channelName = "Test Server";
let channelDes = "Test Description";
let visible = true;
let canMessage = true;

function getOldServerSettings() {
  visibleCheckbox.checked = visible;
  messageCheckbox.checked = canMessage;
  channelNameInput.value = channelName;
  channelDesInput.value = channelDes;
}

function updateServerSettings() {}

function updateChannelSettings() {
  channelName = channelNameInput.value;
  channelDes = channelDesInput.value;
  visible = visibleCheckbox.checked;
  canMessage = messageCheckbox.checked;
  updateSettingsEndpoint(channelName, channelDes, visible, canMessage);
  channelNameHeader.innerText = channelName;
  channel1Header.innerText = channelName;
  channelDesHeader.innerText = channelDes;
}

channelSettingsButton.addEventListener("click", (event) => {
  channelSettingsGui.showModal();
  getOldServerSettings();
});
addChannelButton.addEventListener("click", (event) => {
  newChannelDialog.showModal();
  createChannel();
});
newChannelCancel.addEventListener("click", (event) => {
  newChannelDialog.close();
});
newChannelDialogForm.addEventListener("submit", (event) => {
  event.preventDefault();
  newChannelDialog.close();
});
channelSettingsGui.addEventListener("submit", (event) => {
  event.preventDefault();
  updateChannelSettings();
  channelSettingsGui.close();
});
channelSettingsClose.addEventListener("click", (event) => {
  event.preventDefault();
  channelSettingsGui.close();
});
menuButton.addEventListener("click", (event) => {
  event.preventDefault();
  serverSettingsGui.showModal();
});

messageBoxInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const message = messageBoxInput.value;
    messageBoxInput.value = "";
    createAndAppend("h4", messageViewBox, loggedInDisplayName + ": " + message);
    messageHistory.push(message);
    sendMessage(loggedInDisplayName, message, false);
  }
});

function loadServerData(serverID) {
  let database = "../backend/database.json";
  //let data = database.servers[serverID];
  return 0;
}

function saveServerData(serverID) {
  let database = "../backend/database.json";
  let currentMessages = getMessagesFromClient();
  database.messages = currentMessages;
}

function addFriend(userID) {
  console.log("Friend Added With ID: " + userID);
}

window.onload = async () => {
  currentChatMessages = document.getElementById("channelMessages").children;
  let id = await getChatID(ServerName);
  if (id == undefined) {
    console.error("ServerID = undefined");
  }
  loadServerData(id);
  const msgReceiveInteval = setInterval(() => pollMessages(0), 1000);
};
