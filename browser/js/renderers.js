function renderMessage (message, direction, time, type) {
  var renderers = {
    mediaShare: renderMessageAsPost,
    text: renderMessageAsText,
    like: renderMessageAsLike,
    media: renderMessageAsImage
  }

  var div = dom(`<div class="message ${direction}"></div>`);
  var divContent = dom('<div class="content"></div>');

  if (direction === 'inward') {
    var senderUsername = window.chat.accounts.find((account) => {
      return account.id == message._params.accountId
    })._params.username;
    divContent.appendChild(dom(`<p class="message-sender">${senderUsername}</p>`));
  }

  if (!type && typeof message === 'string') type = 'text';

  if (renderers[type]) renderers[type](divContent, message);
  else renderMessageAsText(divContent, '<unsupported message format>', true);

  divContent.appendChild(dom(
    `<p class="message-time">
      ${time ? formatTime(time) : 'sending ...'}
    </p>`)
  );
  div.appendChild(divContent);
  
  return div
}

function renderMessageAsPost (container, message) {
  var post = message.mediaShare._params;

  if (post.images) {
    // carousels have nested arrays before getting to image url
    var img = dom(`<img src="${post.images[0].url || post.images[0][0].url}">`);
    img.onload = () => scrollToChatBottom();
    container.appendChild(img);
  }

  if (post.caption) {
    container.appendChild(dom(`<p class="post-caption">${truncate(post.caption, 30)}</p>`));
  }
  container.classList.add('ig-media');
  container.onclick = () => renderPost(post)
}

function renderPost (post) {
  const postDom = dom('<div class="center"></div>');
  if (post.videos) {
    postDom.appendChild(dom(`<video width="${post.videos[0].width}" controls>
                                <source src="${post.videos[0].url}" type="video/mp4">
                              </video>`));
  } else if (post.carouselMedia && post.carouselMedia.length) {
    window.carouselInit(postDom, post.images.map((el) => el[0].url))
  } else {
    postDom.appendChild(dom(`<img src="${post.images[0].url}"/>`));
  }
  if (post.caption) {
    postDom.appendChild(dom(`<p class="post-caption">${post.caption}</p>`));
  }
  const browserLink = dom('<button class="view-on-ig">View on Instagram</button>')
  browserLink.onclick = () => openInBrowser(post.webLink)
  postDom.appendChild(browserLink);
  showInViewer(postDom);
}

function renderMessageAsImage (container, message) {
  var url = typeof message === 'string' ? message : message._params.media[0].url
  var img = dom(`<img src="${url}">`);
  img.onload = () => scrollToChatBottom();
  container.appendChild(img);
  container.classList.add('ig-media');

  container.addEventListener('click', () => {
    showInViewer(dom(`<img src="${url}">`));
  })
}

function renderMessageAsLike (container) {
  renderMessageAsImage(container, 'img/love.png');
}

function renderMessageAsText (container, message, noContext) {
  var text = typeof message === 'string' ? message : message._params.text;
  if (URL_REGEX.test(text)) {
    renderMessageWithLink(container, text);
  } else {
    container.appendChild(document.createTextNode(text));
  }

  if (!noContext) container.oncontextmenu = () => renderContextMenu(text);
}

function renderMessageWithLink(container, text) {
  text = text.replace(URL_REGEX, (url) => {
    return `<a href="${url}" class="link-in-message" target="_blank">${url}</a>`;
  });

  container.innerHTML += text;
  var link = container.querySelector('a');
  link.onclick = (e) => {
    e.preventDefault();
    var url = e.target.getAttribute('href');
    url = /^(http|https):\/\//.test(url) ? url : `http://${url}`;
    openInBrowser(url);
  }
}

function renderContextMenu (text) {
  const menu = new Menu();
  const menuItem = new MenuItem({
    label: 'Quote Message',
    click: () => quoteText(text)
  });
  menu.append(menuItem);
  menu.popup();
}

function renderChatListItem (username, msgPreview, thumbnail, id) {
  var li = document.createElement('li');
  li.appendChild(dom(`<div><img class="thumb" src="${thumbnail}"></div>`));
  li.appendChild(dom(`<div class="username"><b>${username}</b><br>${msgPreview}</div>`));
  if (id) li.setAttribute("id", `chatlist-${id}`);

  return li;
}

function renderSearchResult (users) {
  var ul = document.querySelector('.chat-list ul');
  ul.innerHTML = "";
  users.forEach((user) => {
    var li = renderChatListItem(user._params.username, 'send a message', user._params.picture);
    li.onclick = () => {
      setActive(li);
      if (window.chatUsers[user.id]) {
        getChat(window.chatUsers[user.id]);
      } else {
        window.currentChatId = DUMMY_CHAT_ID;
        renderChat({items: [], accounts: [user]});
      }
    }
    ul.appendChild(li);
  })
}

function renderChatList (chatList) {
  var ul = document.querySelector('.chat-list ul');
  ul.innerHTML = "";
  chatList.forEach((chat_) => {
    var msgPreview = getMsgPreview(chat_);
    var usernames = getUsernames(chat_, true);
    var thumbnail = chat_.accounts[0]._params.picture;
    var li = renderChatListItem(usernames, msgPreview, thumbnail, chat_.id);

    registerChatUser(chat_);
    if (isActive(chat_)) setActive(li);
    // don't move this down!
    addNotification(li, chat_);
    chatsHash[chat_.id] = chat_;

    li.onclick = () => {
      markAsRead(chat_.id, li);
      setActive(li);
      getChat(chat_.id);
    }
    ul.appendChild(li);
  })
}

function renderChatHeader (chat_) {
  let usernames = getUsernames(chat_);
  let b = dom(`<b>${usernames}</b>`);

  if (chat_.accounts.length === 1) {
    // open user profile in browser
    b.onclick = () => openInBrowser(`https://instagram.com/${usernames}`)
  }
  let chatTitleContainer = document.querySelector('.chat-title');
  chatTitleContainer.innerHTML = '';
  chatTitleContainer.appendChild(b);
}

function renderChat (chat_) {
  window.chat = chat_;

  var msgContainer = document.querySelector('.chat .messages');
  msgContainer.innerHTML = '';
  renderChatHeader(chat_);
  var messages = chat_.items.slice().reverse();
  messages.forEach((message) => {
    if (message._params.accountId == window.loggedInUserId) var direction = 'outward';
    else var direction = 'inward';

    var div = renderMessage(message, direction,
      message._params.created, message._params.type
    );
    msgContainer.appendChild(div);
  })
  renderMessageSeenText(msgContainer, chat_);
  scrollToChatBottom();

  addSubmitHandler(chat_);
  document.querySelector(MSG_INPUT_SELECTOR).focus();
}

function renderMessageSeenText (container, chat_) {
  container.appendChild(dom(`<div class="seen italic outward"><p>${getIsSeenText(chat_)}</p></div>`));
}

function renderUnfollowers (users) {
  var ul = dom(`<ul class="unfollowers"></ul>`);
  users.forEach((user) => {
    var li = dom(
      `<li>
        <img class="thumb" src="${user._params.picture}">
        <div class="">${user._params.username}</div>
      </li>`
    );
    var unfollowButton = dom(`<button class="unfollow-button">UNFOLLOW</button>`);
    unfollowButton.onclick = () => {
      unfollow(user.id);
      li.remove();
    }
    li.appendChild(unfollowButton);
    ul.appendChild(li);
  })

  showInViewer(ul);
}
