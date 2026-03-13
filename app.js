// app.js

// ===== Popup Navigation =====
var menuBtn    = document.getElementById('menuBtn');
var navPopup   = document.getElementById('navPopup');
var navOverlay = document.getElementById('navOverlay');
var navClose   = document.getElementById('navClose');

function openMenu() {
  navPopup.classList.add('active');
  navOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  navPopup.classList.remove('active');
  navOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

if (menuBtn)    menuBtn.addEventListener('click', openMenu);
if (navClose)   navClose.addEventListener('click', closeMenu);
if (navOverlay) navOverlay.addEventListener('click', closeMenu);

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeMenu();
});

// ===== Download Cards =====
var downloadCards = document.querySelectorAll('.download-card');
downloadCards.forEach(function(card) {
  card.addEventListener('click', function() {
    var label = card.querySelector('.card-label').textContent;
    console.log('Karte geklickt: ' + label);
  });
});
