FROM rabbitmq:3.7.14-management-alpine

COPY custom-docker-entrypoint.sh /usr/local/bin/

ENTRYPOINT [ "/usr/local/bin/custom-docker-entrypoint.sh" ]

CMD [ "rabbitmq-server" ]
