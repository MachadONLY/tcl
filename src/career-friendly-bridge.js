let calendarCareerChanged = false;

window.addEventListener('touchline:career-updated', () => {
  calendarCareerChanged = true;
});

window.addEventListener('hashchange', () => {
  if (!calendarCareerChanged || location.hash === '#calendar') return;
  calendarCareerChanged = false;
  location.reload();
});
