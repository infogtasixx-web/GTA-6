(()=>{
  const menu=document.querySelector('.g-menu');
  const links=document.querySelector('.g-links');
  if(menu&&links){
    menu.addEventListener('click',()=>{
      const open=menu.getAttribute('aria-expanded')!=='true';
      menu.setAttribute('aria-expanded',String(open));
      menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');
      links.classList.toggle('open',open);
    });
    links.addEventListener('click',event=>{
      if(event.target.closest('a')){menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation');links.classList.remove('open');}
    });
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation');links.classList.remove('open');menu.focus();}});
  }
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items=[...new Set(document.querySelectorAll('.g-reveal,[data-reveal],.g-section h2,.g-card,.g-faq details'))];
  if(reduced||!('IntersectionObserver'in window)){items.forEach(item=>item.classList.add('is-visible'));return;}
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    entry.target.classList.add('is-visible');observer.unobserve(entry.target);
  }),{threshold:.12,rootMargin:'0px 0px -40px 0px'});
  items.forEach((item,index)=>{item.classList.add('g-reveal');item.style.setProperty('--delay',`${Math.min(index%4,3)*70}ms`);observer.observe(item);});
})();
