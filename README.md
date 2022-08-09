# WSBStonks Server

NodeJS server written with TypeScript. Part of the greater WSBStonks project which was used to explore fullstack development using NodeJS, React, Kotlin MPP, and TypeScript.

The server connects to a MariaDB/MySQL database and exposes a simple API to allow for queries about the portfolio of stocks that is set up in the database. It updates the data on a timer, and any queries from the client retrieve the previously retrieved data.
