FROM node:20-alpine

WORKDIR /app

# Copier les fichiers package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste du code source
COPY . .

# Exposer le port de Vite
EXPOSE 5173

# Lancer le serveur de développement avec l'option --host pour écouter sur 0.0.0.0
CMD ["npm", "run", "dev", "--", "--host"]
