import axios from 'axios';
import dompurify from 'dompurify';

function searchResultsHTML(stores){
  return stores.map( store => {
    return `
      <a href="/store/${store.slug}" class="search__result">
        <strong>${store.name}</strong>
      </a>
    `;
  }).join('');
}

function typeAhead(search){
  if(!search) return;

  const searchInput = search.querySelector('input[name=search]');
  const searchResults = search.querySelector('.search__results');

  searchInput.on('input', function(){
    if(!this.value){
      searchResults.style.display = 'none';
      return;
    }

    searchResults.style.display = 'block';

    axios
      .get(`/api/search?q=${this.value}`)
      .then(res => {
        if(res.data.length){
          searchResults.innerHTML = dompurify.sanitize(searchResultsHTML(res.data));
          return;
        }
        // tell the user that no results found
        searchResults.innerHTML = dompurify.sanitize(`
          <div class="search__result">
            No results for ${this.value} found!
          </div>`
        );
      })
      .catch(err => {
        console.error(err);
      });
  });

  // handle keyboard inputs
  searchInput.on('keyup', (e) => {
    if(![38, 40, 13].includes(e.keyCode)){
      return;
    }

    const activeClass = 'search__result--active';
    const current = search.querySelector(`.${activeClass}`);
    const items = search.querySelectorAll('.search__result');

    let next;

    if(current){
      switch(e.keyCode){
        case 40: next = current.nextElementSibling || items[0]; break;
        case 38: next = current.previousElementSibling || items[items.length - 1]; break;
        case 13: if(current.href) window.location = current.href; return;
      }
    }else{
      switch(e.keyCode){
        case 40: next = items[0]; break;
        case 38: next = items[items.length - 1]; break;
      }
    }

    if(current){
      current.classList.remove(activeClass);
    }
    next.classList.add(activeClass);
  });
}

export default typeAhead;
