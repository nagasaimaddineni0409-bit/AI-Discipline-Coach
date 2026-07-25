import { orderBy, where } from './baseRepository';
import { COLLECTIONS, userSubcollection } from '../firebase/config';
import { FirestoreRepository } from './baseRepository';
import type { Habit, Goal, Task, Reminder, BehaviourEvent } from '../types';

function habitsPath(uid: string) {
  return userSubcollection(uid, 'habits');
}

function goalsPath(uid: string) {
  return userSubcollection(uid, 'goals');
}

function tasksPath(uid: string) {
  return userSubcollection(uid, 'tasks');
}

function remindersPath(uid: string) {
  return userSubcollection(uid, 'reminders');
}

function eventsPath(uid: string) {
  return userSubcollection(uid, 'behaviourEvents');
}

export class HabitRepository extends FirestoreRepository {
  listByUser(uid: string) {
    return this.list<Habit>(habitsPath(uid), [orderBy('createdAt', 'desc')]);
  }

  subscribeByUser(uid: string, cb: (habits: Habit[]) => void): () => void {
    return this.subscribe<Habit>(habitsPath(uid), [orderBy('createdAt', 'desc')], cb);
  }

  upsert(uid: string, habit: Habit) {
    return this.set(habitsPath(uid), habit.id, habit);
  }

  removeByUser(uid: string, habitId: string) {
    return this.remove(habitsPath(uid), habitId);
  }
}

export class GoalRepository extends FirestoreRepository {
  listByUser(uid: string) {
    return this.list<Goal>(goalsPath(uid), [orderBy('createdAt', 'desc')]);
  }

  subscribeByUser(uid: string, cb: (goals: Goal[]) => void): () => void {
    return this.subscribe<Goal>(goalsPath(uid), [orderBy('createdAt', 'desc')], cb);
  }

  upsert(uid: string, goal: Goal) {
    return this.set(goalsPath(uid), goal.id, goal);
  }

  removeByUser(uid: string, goalId: string) {
    return this.remove(goalsPath(uid), goalId);
  }
}

export class TaskRepository extends FirestoreRepository {
  listForDate(uid: string, dateKey: string) {
    return this.list<Task>(tasksPath(uid), [
      where('scheduledDate', '==', dateKey),
      orderBy('scheduledTime', 'asc'),
    ]);
  }

  subscribeToday(uid: string, dateKey: string, cb: (tasks: Task[]) => void) {
    return this.subscribe<Task>(
      tasksPath(uid),
      [where('scheduledDate', '==', dateKey), orderBy('scheduledTime', 'asc')],
      cb,
    );
  }

  upsert(uid: string, task: Task) {
    return this.set(tasksPath(uid), task.id, task);
  }

  patch(uid: string, taskId: string, data: Partial<Task>) {
    return this.update(tasksPath(uid), taskId, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }
}

export class ReminderRepository extends FirestoreRepository {
  listUpcoming(uid: string, limitCount = 5) {
    const now = new Date().toISOString();
    return this.list<Reminder>(remindersPath(uid), [
      where('scheduledAt', '>=', now),
      orderBy('scheduledAt', 'asc'),
      orderBy('createdAt', 'desc'),
    ]).then((items) => items.slice(0, limitCount));
  }

  upsert(uid: string, reminder: Reminder) {
    return this.set(remindersPath(uid), reminder.id, reminder);
  }

  patch(uid: string, reminderId: string, data: Partial<Reminder>) {
    return this.update(remindersPath(uid), reminderId, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }
}

export class BehaviourEventRepository extends FirestoreRepository {
  listRecent(uid: string, days = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.list<BehaviourEvent>(eventsPath(uid), [
      where('createdAt', '>=', since.toISOString()),
      orderBy('createdAt', 'desc'),
    ]);
  }

  append(uid: string, event: BehaviourEvent) {
    return this.set(eventsPath(uid), event.id, event);
  }
}

export const habitRepository = new HabitRepository();
export const goalRepository = new GoalRepository();
export const taskRepository = new TaskRepository();
export const reminderRepository = new ReminderRepository();
export const behaviourEventRepository = new BehaviourEventRepository();
