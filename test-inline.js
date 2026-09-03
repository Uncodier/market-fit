const React = require('react');
const { renderToString } = require('react-dom/server');
const ReactMarkdown = require('react-markdown').default || require('react-markdown');

function Test() {
  return React.createElement('div', { className: "line-clamp-2 [&_p]:inline" }, 
    React.createElement(ReactMarkdown, {
      components: {
        p: 'span',
        br: () => React.createElement('span', { className: "mx-1" }, " "),
        ul: 'span',
        li: 'span',
      }
    }, "**Sinopsis:**\nCoraline es...\n\n**Ficha:**\n- Director: H")
  );
}
console.log(renderToString(React.createElement(Test)));
