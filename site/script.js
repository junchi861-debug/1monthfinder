const topbar = document.querySelector(".topbar");

const updateTopbar = () => {
  if (!topbar) return;
  topbar.classList.toggle("is-scrolled", window.scrollY > 20);
};

window.addEventListener("scroll", updateTopbar, { passive: true });
updateTopbar();
