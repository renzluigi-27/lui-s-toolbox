document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('keydown', function(e) {
  if (e.key === "F12") e.preventDefault();
  if (e.ctrlKey && e.shiftKey && e.key === "I") e.preventDefault();
  if (e.ctrlKey && e.shiftKey && e.key === "J") e.preventDefault();
  if (e.ctrlKey && e.key === "u") e.preventDefault();
  if (e.ctrlKey && e.key === "s") e.preventDefault();
  if (e.ctrlKey && e.shiftKey && e.key === "C") e.preventDefault();
});
