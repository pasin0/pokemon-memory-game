'use strict';

// Time limits (seconds) per difficulty
const TIME_LIMITS = { 3: 60, 6: 45, 9: 30 };

// Global state 
let firstCard = null,
  secondCard = null,
  lockBoard = false;

let clickCount = 0,
  matchedPairs = 0,
  totalPairs = 0;

let timerInterval = null,
  remainingTime = 0;

let usedPowerup = false;

// Update header counters
function updateStatus() {
  $('#clicks').text(`Clicks: ${clickCount}`);
  $('#matched').text(`Matched: ${matchedPairs}`);
  $('#total-pairs').text(`Total Pairs: ${totalPairs}`);
  $('#pairs-left').text(`Pairs Left: ${totalPairs - matchedPairs}`);
}

// Simple shuffle
function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

// Fetch N random Pokemon sprites
async function getPokemonSprites(n) {
  // Pull & shuffle the full Pokémon list
  const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1500');
  const { results } = await res.json();
  const shuffled = shuffle(results);

  const urls = [];
  const picked = new Set();

  for (const p of shuffled) {
    if (urls.length >= n) break;

    // avoid duplicates by name
    if (picked.has(p.name)) continue;
    picked.add(p.name);

    try {
      // fetch the Pokémon detail
      const data = await fetch(p.url).then(r => r.json());
      // get the official artwork URL
      const url = data.sprites.other?.['official-artwork']?.front_default;
      if (!url) continue;

      // preload the image to confirm it's reachable
      const ok = await new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      });
      if (!ok) continue;

      // it loaded successfully—accept it
      urls.push(url);
    } catch (e) {
      // any network / JSON error then skip it
      continue;
    }
  }

  return urls;
}

// Format seconds as MM:SS
function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// call this when the round ends
function endGame() {
  $('#start-btn').prop('disabled', false);
  $('#difficulty').prop('disabled', false);
}

// Check for a win
function checkWin() {
  if (matchedPairs === totalPairs) {
    clearInterval(timerInterval);
    setTimeout(() => {
      showModal('Congratulations you won!');
      endGame();
    }, 100);
  }
}

// Countdown timer 
function startTimer(limit) {
  clearInterval(timerInterval);
  remainingTime = limit;
  $('#timer').text(formatTime(remainingTime));
  timerInterval = setInterval(() => {
    remainingTime--;
    if (remainingTime < 0) {
      clearInterval(timerInterval);
      $('.card').off('click');    // freeze board
      showModal('Game over! Time’s up.');
      endGame();
      return;
    }
    $('#timer').text(formatTime(remainingTime));
  }, 1000);
}

// Handle a successful match
function disableMatched() {
  $(firstCard).addClass('matched').off('click');
  $(secondCard).addClass('matched').off('click');
  matchedPairs++;
  updateStatus();
  checkWin();
  resetSelection();
}

// Reset the two-card selection
function resetSelection() {
  [firstCard, secondCard] = [null, null];
  lockBoard = false;
}

// Card click handler
function onCardClick() {
  if (lockBoard || $(this).hasClass('flip')) return;

  clickCount++;
  updateStatus();

  $(this).addClass('flip');

  if (!firstCard) {
    firstCard = this;
    return;
  }

  secondCard = this;
  const isMatch = $(firstCard).data('src') === $(secondCard).data('src');

  if (isMatch) {
    disableMatched();
  } else {
    lockBoard = true;
    setTimeout(() => {
      $(firstCard).removeClass('flip');
      $(secondCard).removeClass('flip');
      resetSelection();
    }, 1000);
  }
}

async function setup() {
  const numPairs = parseInt($('#difficulty').val(), 10);

  // assign cols-3 or cols-6 and CSS picks the right layout
  $('#game_grid')
    .removeClass('cols-3 cols-6')
    .addClass(numPairs === 3 ? 'cols-3' : 'cols-6');

  // Show loading message
  $('#game_grid').html('<p>Loading Pokémon…</p>');

  // Fetch & build deck
  const sprites = await getPokemonSprites(numPairs);
  const deck = shuffle([...sprites, ...sprites]);

  // Render cards
  $('#game_grid').empty();
  deck.forEach(src => {
    $('#game_grid').append(`
      <div class="card" data-src="${src}">
        <img class="front_face" src="${src}" alt="Pokémon" />
        <img class="back_face" src="assets/card-back.png" alt="Back" />
      </div>
    `);
  });

  // Reset all game state
  clickCount = 0;
  matchedPairs = 0;
  totalPairs = numPairs;
  usedPowerup = false;
  clearInterval(timerInterval);
  remainingTime = 0;
  lockBoard = false;
  firstCard = secondCard = null;

  // Update header & timer display
  updateStatus();
  $('#timer').text('Time: 00:00');

  // Wire up card clicks
  $('.card').off('click').on('click', onCardClick);

  // Reset power-up state
  usedPowerup = false;
  $('#powerup-btn').prop('disabled', false);
}

// show our themed modal
function showModal(msg) {
  $('#modal-message').text(msg);
  $('#modal-overlay').removeClass('hidden');
}

// hide it again
function hideModal() {
  $('#modal-overlay').addClass('hidden');
}

$(document).ready(() => {
  // bind the OK button *once* at startup:
  $('#modal-ok').on('click', hideModal);

  $('#start-btn').on('click', async () => {
    // if a modal was left open, close it
    hideModal();

    $('#start-btn, #difficulty').prop('disabled', true);

    await setup();

    $('#game_grid').fadeIn(200);

    const n = +$('#difficulty').val();
    startTimer(TIME_LIMITS[n]);
  });

  $('#reset-btn').on('click', async () => {
    hideModal();

    await setup();
    $('#game_grid').fadeIn(200);

    const n = +$('#difficulty').val();
    startTimer(TIME_LIMITS[n]);
  });

  $('#theme-toggle').on('click', () => {
    $('body').toggleClass('dark');
  });

  $('#powerup-btn').on('click', () => {
    if (usedPowerup) return;
    usedPowerup = true;
    $('#powerup-btn').prop('disabled', true);

    // grab all non-matched cards
    const $cards = $('.card').not('.matched');

    // reveal & start glow
    $cards.addClass('flip powerup');

    // after 3s, hide & stop glow
    setTimeout(() => {
      $cards.removeClass('flip powerup');
    }, 3000);
  });

  // Initialize header counts
  updateStatus();
});