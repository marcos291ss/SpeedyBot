function getMessageText(msg) {
  if (!msg.message) return '';

  if (msg.message?.reactionMessage) {
    return '[reactionMessage]';
  }

  return (
    msg.message.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.documentMessage?.caption ||
    msg.message?.buttonsResponseMessage?.selectedButtonId ||
    msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  ).trim();
}

module.exports = { getMessageText };