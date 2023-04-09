require('dayjs/locale/ru');
const dayjs = require('dayjs');
require('dayjs/locale/ru')
dayjs.locale('ru')

const MonthNames = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
const MonthNamesPlain = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]

module.exports = {
  getRemainingDays: function (deadline) {
    const currentDate = dayjs().date();
    let remainingDays;

    if (currentDate >= deadline) {
      const remainingDaysInThisMonth = dayjs().endOf('month').date();
      remainingDays = remainingDaysInThisMonth - currentDate + deadline;   
    } else {
      remainingDays = 25 - currentDate;
    }
    
    return remainingDays;
  },

  getNumberOfDay: function (deadline, date) {
    //const date = dayjs().date();
    let numberOfDay = 0;
    if (date >= deadline) {
      numberOfDay = date - deadline;
    } else {
      const remainingDaysInPreviuusMonth = dayjs().subtract(1, 'month').endOf('month').date() - deadline;
      numberOfDay = remainingDaysInPreviuusMonth + date - 1;
    }

    return numberOfDay;
  },

  getCurrentMonth: function () {
    return dayjs().month();
  },

  getPreviousMonth: function () {
    return dayjs().subtract(1, 'month').month();
  },

  getCurrentDate: function () {
    return dayjs().date();
  },

  getMonthName: function (month) {
    return MonthNames[month];
  },

  getTimeForLogging: function () {
    return dayjs().format('HH:mm:ss')
  }
}