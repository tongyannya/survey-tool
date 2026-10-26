FROM caddy:2

WORKDIR /srv
COPY index.html style.css ./
COPY js ./js

CMD ["caddy", "file-server", "--root", "/srv", "--listen", ":80"]

