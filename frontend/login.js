const server = "http://127.0.0.1:3000";
let loginButton;

function processLogin(displayName, sessionToken) {
  localStorage.setItem("displayName", displayName);
  localStorage.setItem("sessionToken", sessionToken);
  window.location.href = `http://127.0.0.1:5500/frontend/chat.html`;
}

function login(username, password) {
  loginButton.disabled = true;
  fetch(`${server}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
    body: JSON.stringify({
      usr: username,
      psw: password,
    }),
  })
    .then((res) => {
      console.log("received response");
      if (res.ok) {
        return res.json().then((displayname) => {
          processLogin(displayname, 0);
        });
      } else {
        document.getElementById("errorMessage").innerText =
          "Invalid username or password.";
        loginButton.disabled = false;
      }
    })
    .catch((err) => {
      console.error(err);
      loginButton.disabled = false;
      if (
        window.location.href === "http://127.0.0.1:5500/frontend/index.html"
      ) {
        alert("Internal Error Occurred. Please try again later.");
      }
    });
}

async function isServerOnline() {
  await fetch(`${server}/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  })
    .then((res) => {
      if (res.ok) {
        return true;
      } else {
      }
    })
    .catch(() => {
      return false;
    });
}

window.onload = () => {
  const loginForm = document.getElementById("loginForm");
  loginButton = document.getElementById("loginBtn");
  if (isServerOnline() === false) {
    return window.alert("Server is not reachable. Please try again later.");
  }
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    login(
      document.getElementById("usrname").value,
      document.getElementById("pswrd").value
    );
  });
};

function enryptPassword(password) {
  if (password != null) {
    password = "$" + password + "$";
    return password;
  } else {
    console.warn("Password not provided");
  }
}

function decryptPassword(password) {
  if (password != null) {
    password = "$" + password + "$";
    return password;
  } else {
    console.warn("Password not provided");
  }
}
