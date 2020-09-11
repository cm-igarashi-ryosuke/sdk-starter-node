$(function() {
  // Get handle to the chat div
  var $chatWindow = $('#messages');

  // Our interface to the Chat service
  var chatClient;

  // A handle to the "general" chat channel - the one and only channel we
  // will have in this sample app
  var generalChannel;

  // The server will assign the client a random username - store that value
  // here
  var username;

  // Helper function to print info messages to the chat window
  function print(infoMessage, asHtml) {
    var $msg = $('<div class="info">');
    if (asHtml) {
      $msg.html(infoMessage);
    } else {
      $msg.text(infoMessage);
    }
    $chatWindow.append($msg);
  }

  // Helper function to print chat message to the chat window
  function printMessage(fromUser, message, attachiments) {
    var $user = $('<span class="username">').text(fromUser + ':');
    if (fromUser === username) {
      $user.addClass('me');
    }
    var $message = $('<span class="message">').text(message);
    var $container = $('<div class="message-container">');
    $container.append($user).append($message);
    if(attachiments[0]) {
      var url = `https://res.cloudinary.com/cx-mobile-team/${attachiments[0].type}/upload/c_fill,h_300,w_400/${attachiments[0].publicId}`
      var src = `${url}.mp4`
      var poster = `${url}.jpg`
      var $video = $('<video>').attr('src', src).attr('poster', poster)
      $container.append($('<br>')).append($video)
    }
    $chatWindow.append($container);
    $chatWindow.scrollTop($chatWindow[0].scrollHeight);
  }

  // Alert the user they have been assigned a random username
  print('Logging in...');

  // Get an access token for the current user, passing a username (identity)
  $.getJSON('/token', function(data) {


    // Initialize the Chat client
    Twilio.Chat.Client.create(data.token).then(client => {
      console.log('Created chat client');
      chatClient = client;
      chatClient.getSubscribedChannels().then(createOrJoinGeneralChannel);

      // when the access token is about to expire, refresh it
      chatClient.on('tokenAboutToExpire', function() {
        refreshToken(username);
      });

      // if the access token already expired, refresh it
      chatClient.on('tokenExpired', function() {
        refreshToken(username);
      });

    // Alert the user they have been assigned a random username
    username = data.identity;
    print('You have been assigned a random username of: '
    + '<span class="me">' + username + '</span>', true);

    }).catch(error => {
      console.error(error);
      print('There was an error creating the chat client:<br/>' + error, true);
      print('Please check your .env file.', false);
    });
  });

  function refreshToken(identity) {
    console.log('Token about to expire');
    // Make a secure request to your backend to retrieve a refreshed access token.
    // Use an authentication mechanism to prevent token exposure to 3rd parties.
    $.getJSON('/token/' + identity, function(data) {
      console.log('updated token for chat client');          
      chatClient.updateToken(data.token);
    });
  }

  function createOrJoinGeneralChannel() {
    // Get the general chat channel, which is where all the messages are
    // sent in this simple application
    print('Attempting to join "general" chat channel...');
    chatClient.getChannelByUniqueName('general')
    .then(function(channel) {
      generalChannel = channel;
      console.log('Found general channel:');
      console.log(generalChannel);
      setupChannel();
    }).catch(function() {
      // If it doesn't exist, let's create it
      console.log('Creating general channel');
      chatClient.createChannel({
        uniqueName: 'general',
        friendlyName: 'General Chat Channel'
      }).then(function(channel) {
        console.log('Created general channel:');
        console.log(channel);
        generalChannel = channel;
        setupChannel();
      }).catch(function(channel) {
        console.log('Channel could not be created:');
        console.log(channel);
      });
    });
  }

  // Set up channel after it has been found
  function setupChannel() {
    // Join the general channel
    generalChannel.join().then(function(channel) {
      print('Joined channel as '
      + '<span class="me">' + username + '</span>.', true);
    });

    // Listen for new messages sent to the channel
    generalChannel.on('messageAdded', function(message) {
      console.log(message)
      printMessage(
        message.author,
        message.body,
        message.attributes.attachiments
      )
    });
  }

  // Send a new message to the general channel
  var $input = $('#chat-input');
  $input.on('keydown', function(e) {

    if (e.keyCode == 13) {
      if (generalChannel === undefined) {
        print('The Chat Service is not configured. Please check your .env file.', false);
        return;
      }
      var file = $('#chat-file')[0].files[0]
      if (file) {
        /* TwilioのMediaMessageの場合 */

        // var formData = new FormData()
        // formData.append('file', file)
        // generalChannel.sendMessage(formData)

        /* Cloudinaryの場合 */

        uploadFile(file, (response) => {
          const option = {
            attachiments: [
              {
                type: 'video',
                assetId: response.asset_id,
                publicId: response.public_id,
              },
            ],
          }
          generalChannel.sendMessage($input.val(), option)
        })
      } else {
        generalChannel.sendMessage($input.val())
      }
      $input.val('');
    }
  });

  // Send a new message to the general channel
  var $load = $('#chat-load')
  $load.on('click', function(e) {
    generalChannel.getMessages().then((messages) => {
      console.log(messages)
      messages.items.forEach(item => {
        // console.log(item)
        if (item.media) {
          item.media.getContentTemporaryUrl().then(temporaryUrl => {
            console.log(temporaryUrl)
          })
        }
      })
    })
  });

  function uploadFile(file, callback) {
    var cloudName = 'cx-mobile-team'
    var unsignedUploadPreset = 'xwvrfcus'
    var url = `https://api.cloudinary.com/v1_1/${cloudName}/upload`
    var xhr = new XMLHttpRequest()
    var fd = new FormData()
    xhr.open('POST', url, true)
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest')
    fd.append('upload_preset', unsignedUploadPreset)
    fd.append('file', file)

    // Update progress (can be used to show progress indicator)
    xhr.upload.addEventListener('progress', function (e) {
      console.log(`fileuploadprogress data.loaded: ${e.loaded}, data.total: ${e.total}`)
    })

    xhr.onreadystatechange = function (e) {
      if (xhr.readyState == 4 && xhr.status == 200) {
        // File uploaded successfully
        var response = JSON.parse(xhr.responseText)
        console.log(response)
        callback(response)
      }
    }
    xhr.send(fd)
  }
});
