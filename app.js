// app.js -- Erweiterungspunkt fuer kuenftige Interaktionen

// Hamburger-Menu (Navigation folgt in spaeteren Ticket)
const hamburgerBtn = document.querySelector('.hamburger-menu');

hamburgerBtn.addEventListener('click', function() {
  console.log('Menu geklickt -- Navigation folgt in spaeteren Ticket.');
});

// Download-Karten (Aktionen folgen in spaeteren Ticket)
const downloadCards = document.querySelectorAll('.download-card');

downloadCards.forEach(function(card) {
  card.addEventListener('click', function() {
    const label = card.querySelector('.card-label').textContent;
    console.log('Karte geklickt: ' + label);
  });
});
