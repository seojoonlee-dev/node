# Node note taker



Node is a self hosted, no-bs, extremely simple and lightweight note taking app which offers WYSIWYG editing using Tiptap. No AI, no encryption, no grammer checking, no drawing, no bloat. Just text and editing.

Node uses Express with Node.js as its backend and React + Typescript as the frontend.



### Markdown



In node, makedown is done completely headlessly, meaning there isn't a bold button to bold your text (unless you decide to change it. it's opensource after all). Instead it uses the Tiptap editor's built-in markdown shortcuts. Refer to the official Tiptap documents for more info: [https://tiptap.dev/docs/examples/basics/markdown-shortcuts](https://tiptap.dev/docs/examples/basics/markdown-shortcuts)



### Quick Start



#### Installation

Simply clone this repo and build with docker compose.



```
git clone https://github.com/seojoonlee-dev/node
cd node
docker compose up --build
```



You shall now be able to access the fronend at [http://localhost:8080](http://localhost:8080). Additionally, the backend will use port 3001 by default. If you wish to manually change which port to use simply edit docker-compose.yml.



#### Updating

Simply pull this repo inside /node and rebuild with docker compose.



```
cd node
git pull
docker compose up --build
```



### Note



This is a very early version of node that just offers text edit and nothing else. Like the name suggests, I am currently planning on adding branching files, customization in the browser (so you don't have to edit the css files to change them), and a lot more. I will also be adding changes to how the text file is saved. For example while currently the text is saved as an html file I will change it so that it actually just saves the text.



&nbsp;

&nbsp;