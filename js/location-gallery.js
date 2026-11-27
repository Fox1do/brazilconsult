(() => {
  const locations = {
    singular: {name: 'Península · Barra da Tijuca · Рио-де-Жанейро', photos: [{src:'/properties/brazil/rio-de-janeiro/shared/peninsula/images/0182.webp',full:'/properties/brazil/rio-de-janeiro/shared/peninsula/images/0182.jpg',caption:'Península — общий вид'},{src:'/properties/brazil/rio-de-janeiro/tegra/singular/images/location/singular-1.webp',full:'/properties/brazil/rio-de-janeiro/tegra/singular/images/location/singular-1.jpg',caption:'Singular — строительная площадка'},{src:'/properties/brazil/rio-de-janeiro/tegra/singular/images/location/singular-2.webp',full:'/properties/brazil/rio-de-janeiro/tegra/singular/images/location/singular-2.jpg',caption:'Singular — строительная площадка'},{src:'/properties/brazil/rio-de-janeiro/tegra/singular/images/location/singular-3.webp',full:'/properties/brazil/rio-de-janeiro/tegra/singular/images/location/singular-3.jpg',caption:'Singular — окружение'}]},
    peninsula: {name: 'Península · Barra da Tijuca · Рио-де-Жанейро', photos: [
      {src: '/properties/brazil/rio-de-janeiro/shared/peninsula/images/0182.webp', full: '/properties/brazil/rio-de-janeiro/shared/peninsula/images/0182.jpg', caption: 'Península — общий вид'},
      {src: '/properties/brazil/rio-de-janeiro/shared/peninsula/images/0593.webp', full: '/properties/brazil/rio-de-janeiro/shared/peninsula/images/0593.jpg', caption: 'Península — вид сверху'},
      {src: '/properties/brazil/rio-de-janeiro/shared/peninsula/images/0597.webp', full: '/properties/brazil/rio-de-janeiro/shared/peninsula/images/0597.jpg', caption: 'Окружение и строительная площадка'}
    ]}
  };
  document.querySelectorAll('[data-location-gallery]').forEach(section => {
    const location = locations[section.dataset.locationGallery];
    if (!location) return;
    const photos = location.photos.filter(photo => photo.src);
    if (!photos.length) return;
    section.querySelector('.location-gallery__name').textContent = location.name;
    const grid = section.querySelector('.gran-gallery__grid');
    photos.forEach(photo => {
      const figure = document.createElement('figure');
      const link = document.createElement('a'); link.href = photo.full || photo.src; link.dataset.lightbox = ''; link.setAttribute('aria-label', 'Увеличить: ' + photo.caption);
      const img = document.createElement('img'); img.src = photo.src; img.alt = photo.caption; img.loading = 'lazy'; link.append(img); figure.append(link);
      const caption = document.createElement('figcaption'); caption.textContent = photo.caption; figure.append(caption); grid.append(figure);
    });
    section.hidden = false;
  });
})();