"""FSM states для регистрации и других multi-step потоков."""

from aiogram.fsm.state import State, StatesGroup


class Registration(StatesGroup):
    choosing_language = State()
    name = State()
    birth_year = State()
    phone = State()
    face_photo = State()
    treatment_start_date = State()
    drugs = State()
    reminder_time = State()


class SideEffectChat(StatesGroup):
    listening = State()
