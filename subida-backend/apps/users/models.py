from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Administrador'),
        ('operador', 'Operador'),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='operador')
    telefono = models.CharField(max_length=20, blank=True)

    class Meta:
        db_table = 'users'
        verbose_name = 'usuario'
        verbose_name_plural = 'usuarios'

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"
